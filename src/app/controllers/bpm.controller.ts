import {BandcampFacade} from '../facades/bandcamp.facade';
import {WaveformService} from '../services/waveform.service';
import {BpmService} from '../services/bpm.service';
import {AudioUtils} from '../utils/audio-utils';
import {Logger} from '../utils/logger';
import {BpmResult} from '../utils/bpm/types';
import {BPM_BADGE_CLASS, WAVEFORM_HOST_CLASS} from '../constants';

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

  public static initialize(): void {
    if (!BandcampFacade.isTrack && !BandcampFacade.isAlbum) {
      return;
    }
    // Single-slot consumer; re-registering on SPA re-init just overwrites it.
    WaveformService.setBufferConsumer((channel, sampleRate, streamId) => {
      BpmController.onDecodedBuffer(channel, sampleRate, streamId);
    });
    this.ensureBadge();
  }

  /**
   * Fed by the waveform decode. Analyzes synchronously, then renders only if this
   * is still the current track (token unchanged and the live stream id matches).
   */
  public static onDecodedBuffer(channel: Float32Array, sampleRate: number, streamId: string): void {
    const token = ++this.generationToken;
    this.ensureBadge();
    this.setText('BPM …'); // analyzing

    let result: BpmResult;
    try {
      result = BpmService.analyzeFromChannel(channel, sampleRate, streamId);
    } catch (error) {
      Logger.error('BPM controller analysis error:', error);
      result = {bpm: null, confidence: 0};
    }

    if (token !== this.generationToken) {
      return; // superseded by a newer track
    }
    const liveSrc = AudioUtils.getAudioElement()?.src;
    const liveStream = liveSrc ? WaveformService.extractStreamId(liveSrc) : null;
    if (liveStream && liveStream !== streamId) {
      return; // user skipped; this result is for a track no longer playing
    }
    this.renderResult(result);
  }

  public static cleanup(): void {
    this.generationToken++;
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
    this.setText('BPM —'); // placeholder; on the waveform it shows in the corner
  }

  private static renderResult(result: BpmResult): void {
    if (result.bpm === null) {
      this.setText('BPM —'); // beatless / low confidence
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
