import {BandcampFacade} from '../facades/bandcamp.facade';
import {WaveformService} from '../services/waveform.service';
import {BpmService} from '../services/bpm.service';
import {AudioUtils} from '../utils/audio-utils';
import {Logger} from '../utils/logger';
import {BpmResult} from '../utils/bpm/types';
import {BPM_BADGE_CLASS, WAVEFORM_HOST_CLASS} from '../constants';

interface BpmWorkerResponse {
  token: number;
  streamId: string;
  result: BpmResult;
}

/**
 * Always-on BPM badge for track/album pages. It does no fetching/decoding of its
 * own: it registers as a consumer of the waveform pipeline's decoded PCM and
 * analyzes that same buffer, so BPM is a near-free byproduct of the decode the
 * waveform already performs on play. Mirrors WaveformController's token-based
 * stale-cancellation so a track skip never stamps a stale BPM onto the new track.
 */
export class BpmController {
  private static badgeEl: HTMLElement | null = null;
  private static generationToken = 0;
  private static lastStreamId: string | null = null;
  private static watching = false;
  private static worker: Worker | null = null;
  private static workerFailed = false;
  private static workerSetupStarted = false;

  public static initialize(): void {
    if (!BandcampFacade.isTrack && !BandcampFacade.isAlbum) {
      return;
    }
    // Single-slot consumer; re-registering on SPA re-init just overwrites it.
    WaveformService.setBufferConsumer((channel, sampleRate, streamId) => {
      BpmController.onDecodedBuffer(channel, sampleRate, streamId);
    });
    this.ensureBadge();
    this.setupTrackWatcher();
    this.setupWorker();
  }

  /**
   * Watch for the audio source changing (skip to another track) so we can reset
   * the badge immediately rather than leaving the previous track's BPM up while
   * the new one decodes: show the cached value if we have it, otherwise clear to
   * the pending placeholder. Driven by the audio element's own loadstart/play
   * events (onDecodedBuffer is the backstop once the new track decodes); no
   * polling timer -- WaveformController already runs one and the events suffice.
   * Listeners are attached once for the life of the content script (guarded), so
   * SPA re-inits don't stack them.
   */
  private static setupTrackWatcher(): void {
    if (this.watching) {
      return;
    }
    this.watching = true;
    const check = (): void => this.handleTrackChange();
    document.addEventListener('loadstart', (e) => {
      if (e.target instanceof HTMLAudioElement) {
        check();
      }
    }, true);
    document.addEventListener('play', (e) => {
      if (e.target instanceof HTMLAudioElement) {
        check();
      }
    }, true);
  }

  private static handleTrackChange(): void {
    if (!BandcampFacade.isTrack && !BandcampFacade.isAlbum) {
      return;
    }
    const src = AudioUtils.getAudioElement()?.src;
    const streamId = src ? WaveformService.extractStreamId(src) : null;
    if (!streamId || streamId === this.lastStreamId) {
      return;
    }
    this.lastStreamId = streamId;
    this.generationToken++; // cancel any in-flight analysis for the previous track
    this.ensureBadge();
    // Cached -> show the number instantly; not cached -> clear to the placeholder.
    this.renderResult(BpmService.getCached(streamId) ?? {bpm: null, confidence: 0});
  }

  /**
   * Fed by the waveform decode. Offloads the heavy analysis to the Web Worker
   * (so it never janks playback); applyResult renders the worker's reply only if
   * the track is still current. Falls back to synchronous main-thread analysis if
   * the worker can't be created. Serves an instant result from cache when present.
   */
  public static onDecodedBuffer(channel: Float32Array, sampleRate: number, streamId: string): void {
    this.ensureBadge();
    const token = ++this.generationToken;

    const cached = BpmService.getCached(streamId);
    if (cached) {
      this.applyResult(token, streamId, cached);
      return;
    }

    if (this.worker) {
      // Structured-clone the channel (don't transfer -- the waveform's RMS pass
      // still reads this same Float32Array after we return).
      this.worker.postMessage({token, streamId, sampleRate, channel});
      return;
    }

    // Fallback: analyze synchronously on the main thread (worker not ready yet,
    // or unavailable on this browser).
    let result: BpmResult;
    try {
      result = BpmService.analyzeFromChannel(channel, sampleRate, streamId);
    } catch (error) {
      Logger.error('BPM controller analysis error:', error);
      result = {bpm: null, confidence: 0};
    }
    this.applyResult(token, streamId, result);
  }

  private static onWorkerMessage(e: MessageEvent<BpmWorkerResponse>): void {
    const {token, streamId, result} = e.data;
    BpmService.cacheResult(streamId, result);
    this.applyResult(token, streamId, result);
  }

  /** Render a result only if it's still for the current track. */
  private static applyResult(token: number, streamId: string, result: BpmResult): void {
    if (token !== this.generationToken) {
      return; // superseded by a newer track while analysis was in flight
    }
    const liveSrc = AudioUtils.getAudioElement()?.src;
    const liveStream = liveSrc ? WaveformService.extractStreamId(liveSrc) : null;
    if (liveStream && liveStream !== streamId) {
      return; // user skipped; result is for a track no longer playing -- do NOT
      // touch lastStreamId, or the watcher would desync from the live track
    }
    // Only now mark this as the displayed track (after confirming it's current).
    this.lastStreamId = streamId;
    this.renderResult(result);
  }

  /**
   * Create the analysis Worker once, asynchronously. A content script cannot do
   * `new Worker('chrome-extension://...')` -- the page origin blocks it -- so we
   * fetch the (web-accessible) worker script and run it from a same-origin blob:
   * URL. Runs at init; until it's ready, onDecodedBuffer uses the main-thread
   * fallback. If anything fails, BPM stays on the main thread.
   */
  private static setupWorker(): void {
    if (this.workerSetupStarted) {
      return;
    }
    this.workerSetupStarted = true;
    void (async () => {
      try {
        const res = await fetch(chrome.runtime.getURL('scripts/bpm.worker.js'));
        if (!res.ok) {
          throw new Error(`worker fetch ${res.status}`);
        }
        const code = await res.text();
        const blobUrl = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
        const worker = new Worker(blobUrl);
        URL.revokeObjectURL(blobUrl); // worker keeps running after revoke
        worker.onmessage = (e: MessageEvent<BpmWorkerResponse>) => BpmController.onWorkerMessage(e);
        worker.onerror = (err) => {
          Logger.error('BPM worker error; using main thread:', err.message);
          BpmController.workerFailed = true;
          BpmController.worker = null;
        };
        BpmController.worker = worker;
      } catch (error) {
        Logger.error('BPM worker setup failed; using main thread:', error);
        BpmController.workerFailed = true;
      }
    })();
  }

  public static cleanup(): void {
    this.generationToken++;
    this.lastStreamId = null; // next page's first track counts as a change
    if (this.badgeEl) {
      this.badgeEl.remove();
      this.badgeEl = null;
    }
  }

  private static ensureBadge(): void {
    if (this.badgeEl && document.body.contains(this.badgeEl)) {
      return;
    }
    const badge = document.createElement('div');
    badge.className = BPM_BADGE_CLASS;

    const host = document.querySelector<HTMLElement>(`.${WAVEFORM_HOST_CLASS}`);
    if (host) {
      // Overlay in the waveform's top-right corner: no extra row, visually tied
      // to the audio. The waveform only clears children by its own bcks-waveform-*
      // classes, so this badge survives play/track-change state swaps.
      // pointer-events:none keeps the waveform's click-to-seek working underneath.
      if (window.getComputedStyle(host).position === 'static') {
        host.style.position = 'relative';
      }
      badge.style.cssText = [
        'position:absolute',
        'top:5px',
        'right:7px',
        // Override the host's `> * { width:100%; min-height:inherit }` flex rule,
        // which would otherwise stretch the badge across the whole waveform.
        'left:auto',
        'width:max-content',
        'min-height:0',
        'z-index:2',
        'pointer-events:none',
        'padding:1px 7px',
        'font-size:11px',
        'font-weight:600',
        'letter-spacing:0.04em',
        'line-height:1.5',
        'border-radius:9px',
        'background:rgba(0,0,0,0.55)',
        'color:#fff',
      ].join(';');
      host.appendChild(badge);
    } else {
      // Fallback when the waveform host is absent: a small pill below the speed
      // controls (its own line, but only when there's no waveform to overlay).
      badge.style.cssText = [
        'display:inline-block',
        'margin:4px 0',
        'padding:2px 9px',
        'font-size:11px',
        'font-weight:600',
        'letter-spacing:0.04em',
        'line-height:1.6',
        'border-radius:10px',
        'background:rgba(128,128,128,0.18)',
        'color:inherit',
        'opacity:0.85',
      ].join(';');
      BandcampFacade.insertBelowSpeedController(badge);
    }

    this.badgeEl = badge;
    this.setText('--- BPM'); // placeholder; on the waveform it shows in the corner
  }

  private static renderResult(result: BpmResult): void {
    // Treat null AND any non-finite/non-positive value as "no reading" so a bad
    // analysis can never render a garbage badge like "-3 BPM" or "Infinity BPM".
    if (result.bpm === null || !Number.isFinite(result.bpm) || result.bpm <= 0) {
      this.setText('--- BPM'); // beatless / low confidence / invalid
    } else {
      this.setText(`${Math.round(result.bpm)} BPM`);
    }
  }

  private static setText(text: string): void {
    if (this.badgeEl) {
      this.badgeEl.textContent = text;
    }
  }
}
