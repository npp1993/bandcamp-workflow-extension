import {WaveformService} from '../services/waveform.service';
import {BandcampFacade} from '../facades/bandcamp.facade';
import {AudioUtils} from '../utils/audio-utils';
import {SeekUtils} from '../utils/seek-utils';
import {Logger} from '../utils/logger';
import {
  WAVEFORM_CONTAINER_CLASS,
  WAVEFORM_ELEMENT_SELECTOR,
  WAVEFORM_ERROR_CLASS,
  WAVEFORM_HOST_CLASS,
  WAVEFORM_LOADING_CLASS,
} from '../constants';

/**
 * Controller for waveform integration with Bandcamp pages
 * Handles UI integration and lifecycle management
 */
export class WaveformController {
  private static currentWaveformContainer: HTMLElement | null = null;

  private static isGenerating = false;

  private static lastAudioSrc = '';

  private static debounceTimer: number | null = null;

  private static generationPromise: Promise<void> | null = null;

  // Monotonic id for the most recently requested generation. Bumped on every
  // generateWaveformIfNeeded so a slow/in-flight fetch for a track the user
  // already skipped past can detect it has been superseded and discard its
  // result, rather than blocking the current track's waveform behind it.
  private static generationToken = 0;

  /**
   * Initialize waveform functionality on the current page
   */
  public static initialize(): void {
    try {
      // Only initialize on supported page types
      if (!this.isPageSupported()) {
        return;
      }

      // Reserve the waveform slot now so starting playback later does not shift
      // the rest of the page down.
      this.ensureWaveformHost();

      // Set up audio event listeners to detect track changes
      this.setupAudioEventListeners();

      // Generate initial waveform if audio is already present
      this.generateWaveformIfNeeded();
    } catch (error) {
      Logger.error('Error initializing waveform functionality:', error);
    }
  }

  /**
   * Check if the current page supports waveform display
   *
   * @returns True if page supports waveforms
   */
  private static isPageSupported(): boolean {
    // Support track and album pages only (not wishlist pages)
    return BandcampFacade.isTrack || BandcampFacade.isAlbum;
  }

  /**
   * Set up event listeners to detect audio changes and regenerate waveforms
   */
  private static setupAudioEventListeners(): void {
    try {
      // When an audio signal arrives, first drop the previous track's waveform
      // immediately (showing the loading state), then debounce the expensive
      // regeneration. The immediate clear is what stops the old waveform from
      // lingering under the new track for the whole debounce + fetch window.
      const onAudioSignal = (delay: number) => {
        this.clearWaveformIfTrackChanged();
        this.debouncedGenerateWaveform(delay);
      };

      // Check for audio source changes periodically (fallback for missed events)
      setInterval(() => {
        const audio = AudioUtils.getAudioElement();
        if (audio && audio.src && audio.src !== this.lastAudioSrc) {
          onAudioSignal(300);
        }
      }, 1000);

      // Listen for loadstart events on audio elements (existing and future)
      document.addEventListener('loadstart', (event) => {
        if (event.target instanceof HTMLAudioElement) {
          onAudioSignal(1000);
        }
      }, true);

      // Listen for play events
      document.addEventListener('play', (event) => {
        if (event.target instanceof HTMLAudioElement) {
          onAudioSignal(500);
        }
      }, true);
    } catch (error) {
      Logger.error('Error setting up audio event listeners:', error);
    }
  }

  /**
   * If the audio source changed since the current waveform was rendered, remove
   * that now-stale waveform and show the loading spinner right away. This
   * decouples clearing the old track's waveform (immediate) from rendering the
   * new one (debounced + async), so the previous waveform never lingers under
   * the new track. No-op when the source is unchanged or the loading state is
   * already showing for this change.
   */
  private static clearWaveformIfTrackChanged(): void {
    const audio = AudioUtils.getAudioElement();
    if (!audio || !audio.src || audio.src === this.lastAudioSrc) {
      return;
    }

    // showLoadingIndicator drops the stale waveform and is idempotent, so a
    // spinner already up for this change is left running.
    this.showLoadingIndicator();
  }

  /**
   * Check if extension context is still valid for waveform operations
   *
   * @returns True if extension context is valid
   */
  private static isExtensionContextValid(): boolean {
    try {
      // Try to access chrome runtime
      if (!chrome?.runtime?.id) {
        return false;
      }
      
      // Check if we can access the extension ID
      return chrome.runtime.id !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate waveform if conditions are met
   */
  private static async generateWaveformIfNeeded(): Promise<void> {
    try {
      // Double-check that we're not on a wishlist page (additional safety check)
      if (BandcampFacade.isWishlistPage) {
        return;
      }

      // Check if extension context is still valid before attempting generation
      if (!this.isExtensionContextValid()) {
        return;
      }

      // Check if audio is available and ready
      const audio = AudioUtils.getAudioElement();
      if (!audio || !audio.src) {
        return;
      }

      // Skip if audio source hasn't changed and we already have a waveform
      if (audio.src === this.lastAudioSrc && this.currentWaveformContainer &&
          !this.currentWaveformContainer.classList.contains(WAVEFORM_LOADING_CLASS) &&
          !this.currentWaveformContainer.classList.contains(WAVEFORM_ERROR_CLASS)) {
        return;
      }

      // Newest request wins. We do NOT wait for an in-flight generation to
      // finish: a slow/stalled fetch for a previous track (up to the 30s fetch
      // timeout) would otherwise block the current track's waveform, leaving the
      // spinner up while audio plays fine. Instead we start generating the
      // current src immediately and let the stale generation discard itself via
      // the token check in performWaveformGeneration.
      const src = audio.src;
      const token = ++this.generationToken;
      this.generationPromise = this.performWaveformGeneration(src, token);
      await this.generationPromise;
      if (token === this.generationToken) {
        this.generationPromise = null;
      }
    } catch (error) {
      Logger.error('Error in generateWaveformIfNeeded:', error);
    }
  }

  /**
   * Perform the actual waveform generation process
   */
  private static async performWaveformGeneration(audioSrc: string, token: number): Promise<void> {
    try {
      this.isGenerating = true;

      // Show loading indicator (clears any rendered waveform, and reuses the
      // spinner if the immediate track-change clear already mounted one).
      this.showLoadingIndicator();

      // Generate the waveform for THIS specific src (not "current"), so a track
      // change mid-fetch can't make us render the wrong track.
      const waveformCanvas = await WaveformService.generateWaveformForAudioSrc(audioSrc);

      // Superseded: the user skipped to another track while we were
      // fetching/decoding. Discard this result and leave the spinner up for the
      // newer generation; do NOT advance lastAudioSrc, so the fallback interval
      // keeps re-triggering until the current track actually renders.
      if (token !== this.generationToken) {
        return;
      }

      // We are the live request: commit. Setting lastAudioSrc only here (after a
      // non-superseded result) keeps it in sync with what is actually on screen.
      this.lastAudioSrc = audioSrc;
      this.removeLoadingIndicator();

      if (waveformCanvas) {
        // Insert the waveform into the page
        this.insertWaveform(waveformCanvas);
      } else {
        Logger.warn('Failed to generate waveform');
        this.showErrorIndicator();
      }
    } catch (error) {
      Logger.error('Error generating waveform:', error);
      if (token === this.generationToken) {
        this.removeLoadingIndicator();
        this.showErrorIndicator();
      }
    } finally {
      if (token === this.generationToken) {
        this.isGenerating = false;
      }
    }
  }

  /**
   * Insert waveform canvas into the page using BandcampFacade
   *
   * @param canvas Waveform canvas element
   */
  private static insertWaveform(canvas: HTMLCanvasElement): void {
    try {
      // Create container for the waveform
      const container = document.createElement('div');
      container.className = WAVEFORM_CONTAINER_CLASS;

      // Add canvas to container
      container.appendChild(canvas);

      // Set up click-to-seek functionality
      this.setupClickToSeek(container, canvas);

      // Set up playhead position tracking
      this.setupPlayheadTracking(container, canvas);

      // Render into the reserved slot so the page does not shift; fall back to a
      // direct insert if the slot could not be created.
      this.mountInWaveformHost(container);

      this.currentWaveformContainer = container;
    } catch (error) {
      Logger.error('Error inserting waveform:', error);
    }
  }

  /**
   * Get (creating if needed) the persistent fixed-height slot that holds the
   * waveform and its loading/error states. Reserving it up front means starting
   * playback never pushes the rest of the page down. Track/album pages only.
   *
   * @returns The host element, or null if the page is unsupported
   */
  private static ensureWaveformHost(): HTMLElement | null {
    if (!this.isPageSupported()) {
      return null;
    }

    const existing = document.querySelector<HTMLElement>(`.${WAVEFORM_HOST_CLASS}`);
    if (existing) {
      return existing;
    }

    const host = document.createElement('div');
    host.className = WAVEFORM_HOST_CLASS;

    // Insert below the speed controller if it exists, otherwise below the player.
    BandcampFacade.insertBelowSpeedController(host);
    this.reserveHostHeight(host);

    return host;
  }

  /**
   * Reserve the exact height the rendered waveform will occupy. The canvas keeps
   * an 8:1 ratio and now fills the full container width (CSS width:100%), so the
   * reserved height tracks the host's own width with no 600px cap.
   *
   * @param host The waveform host element
   */
  private static reserveHostHeight(host: HTMLElement): void {
    const width = host.clientWidth;
    // canvas display width = container content width = host width minus the
    // container's 5px horizontal padding and 1px border on each side (12 total).
    const canvasWidth = width > 0 ? width - 12 : 600;
    // canvas display height = width / 8 (8:1), + container padding (5*2) and border (1*2)
    const reserved = Math.round(canvasWidth / 8) + 12;
    host.style.minHeight = `${reserved}px`;
  }

  /**
   * Append a waveform state element (loading/waveform/error) into the reserved
   * host slot, falling back to a direct page insert if the slot is unavailable.
   *
   * @param element The state element to mount
   */
  private static mountInWaveformHost(element: HTMLElement): void {
    const host = this.ensureWaveformHost();
    if (host) {
      // Recompute the reserved height from the host's current width on every
      // mount, so the loading box and the eventually-rendered waveform (both
      // 8:1, filling the full width) always reserve the same height -- no shift
      // when the real waveform swaps in, even if the column width changed.
      this.reserveHostHeight(host);
      host.appendChild(element);
    } else {
      BandcampFacade.insertBelowSpeedController(element);
    }
  }

  /**
   * Set up click-to-seek functionality for the waveform
   *
   * @param container Waveform container element
   * @param canvas Waveform canvas element
   */
  private static setupClickToSeek(container: HTMLElement, canvas: HTMLCanvasElement): void {
    container.addEventListener('click', (event) => {
      try {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const ratio = x / rect.width;
        
        // Clamp ratio between 0 and 1
        const clampedRatio = Math.max(0, Math.min(1, ratio));
        
        // Use SeekUtils to seek to the clicked position
        const isWishlistPage = BandcampFacade.isWishlistPage;
        SeekUtils.seekToRatio(clampedRatio, isWishlistPage);
      } catch (error) {
        Logger.error('Error in click-to-seek:', error);
      }
    });
  }

  /**
   * Set up playhead position tracking for the waveform
   *
   * @param container Waveform container element
   * @param canvas Waveform canvas element
   */
  private static setupPlayheadTracking(container: HTMLElement, canvas: HTMLCanvasElement): void {
    try {
      // Get the current audio source for waveform data lookup
      const audio = AudioUtils.getAudioElement();
      if (!audio || !audio.src) {
        return;
      }

      const streamId = WaveformService.extractStreamId(audio.src);
      if (!streamId) {
        return;
      }

      // Set up audio time update listener
      const updatePlayhead = () => {
        const currentAudio = AudioUtils.getAudioElement();
        if (currentAudio && !isNaN(currentAudio.duration) && currentAudio.duration > 0) {
          const progress = currentAudio.currentTime / currentAudio.duration;
          
          // Get the cached waveform data
          const waveformData = WaveformService.getWaveformDataForStream(streamId);
          if (waveformData) {
            // Update the canvas with progress
            WaveformService.updateWaveformProgress(canvas, waveformData, progress);
          }
        }
      };

      // Add event listener to audio element
      if (audio) {
        audio.addEventListener('timeupdate', updatePlayhead);
        
        // Store reference for cleanup
        container.setAttribute('data-timeupdate-listener', 'true');
        (container as any)._timeUpdateListener = updatePlayhead;
        (container as any)._audioElement = audio;
        (container as any)._streamId = streamId;
      }

      // Initial update
      updatePlayhead();
    } catch (error) {
      Logger.error('Error setting up playhead tracking:', error);
    }
  }

  /**
   * Remove the current waveform from the page
   */
  private static removeCurrentWaveform(): void {
    // Remove any existing waveform containers (including loading and error states)
    const existingContainers = document.querySelectorAll(
      WAVEFORM_ELEMENT_SELECTOR,
    );
    
    existingContainers.forEach((container) => {
      if (container.parentNode) {
        // Clean up event listeners if this is our tracked container
        if (container === this.currentWaveformContainer) {
          if (container.getAttribute('data-timeupdate-listener')) {
            const listener = (container as any)._timeUpdateListener;
            const audioElement = (container as any)._audioElement;
            if (listener && audioElement) {
              audioElement.removeEventListener('timeupdate', listener);
            }
          }
        }

        // Clear any animation intervals
        const intervalId = (container as HTMLElement).dataset.intervalId;
        if (intervalId) {
          clearInterval(parseInt(intervalId));
        }
        
        container.parentNode.removeChild(container);
      }
    });
    
    this.currentWaveformContainer = null;
  }

  /**
   * Show the loading state while the waveform is being generated: a small spinner
   * centered over a translucent shade that fills the box up to the live playhead,
   * so the shaded background doubles as a playhead while the real waveform loads.
   * The shade is updated by a single setInterval whose id is stored on the
   * container's dataset, so the existing removeLoadingIndicator/
   * removeCurrentWaveform paths already stop it -- no extra listeners to leak.
   */
  private static showLoadingIndicator(): void {
    try {
      // Idempotent: if the loading state is already up (e.g. the immediate
      // track-change clear mounted it), reuse it rather than tearing it down and
      // recreating the element + its animation.
      if (this.currentWaveformContainer?.classList.contains(WAVEFORM_LOADING_CLASS)) {
        return;
      }

      // Drop any rendered waveform/error before showing the loading state.
      this.removeCurrentWaveform();

      const container = document.createElement('div');
      container.className = WAVEFORM_LOADING_CLASS;
      // Mirror the rendered waveform container's box exactly so swapping the real
      // waveform in causes zero shift, and clip the shade to the rounded corners.
      container.style.cssText = `
        position: relative;
        padding: 5px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(190, 190, 190, 0.3);
        overflow: hidden;
      `;

      // Theme text color so both the shade and spinner contrast on any theme
      // (a fixed gray vanishes on a black/dark theme).
      const rgb = this.loadingRgb();

      // Shaded background filling up to the playhead, with a brighter leading
      // edge that reads as the playhead line. Updated each tick below.
      const shade = document.createElement('div');
      shade.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0%;
        background: rgba(${rgb}, 0.13);
        border-right: 2px solid rgba(${rgb}, 0.45);
        box-sizing: border-box;
        pointer-events: none;
      `;
      container.appendChild(shade);

      // Rotating spinner (Web Animations API), centered on top of the shade.
      const spinner = document.createElement('div');
      spinner.style.cssText = `
        position: relative;
        z-index: 1;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid rgba(${rgb}, 0.9);
        border-right-color: transparent;
      `;
      spinner.animate(
        [{transform: 'rotate(0deg)'}, {transform: 'rotate(360deg)'}],
        {duration: 700, iterations: Infinity},
      );
      container.appendChild(spinner);

      // Track the playhead: resize the shade each tick from the live audio
      // position (cheap -- just a width update). Guard the pre-metadata NaN.
      const updateShade = (): void => {
        const audio = AudioUtils.getAudioElement();
        let progress = 0;
        if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
          progress = Math.min(1, Math.max(0, audio.currentTime / audio.duration));
        }
        shade.style.width = `${progress * 100}%`;
      };
      updateShade();
      const intervalId = window.setInterval(updateShade, 100);
      container.dataset.intervalId = String(intervalId);

      this.mountInWaveformHost(container);
      this.currentWaveformContainer = container;
    } catch (error) {
      Logger.error('[WaveformController] Error showing loading indicator:', error);
    }
  }

  /**
   * The page's theme text color as an "r, g, b" string for the loading
   * placeholder, so it contrasts with the page background on light AND dark
   * themes. Falls back to mid-gray when the color scheme isn't available.
   *
   * @returns Comma-separated rgb components (e.g. "255, 255, 255")
   */
  private static loadingRgb(): string {
    const hex = BandcampFacade.colors?.text_color?.replace('#', '');
    if (hex && /^[0-9a-fA-F]{6}$/.test(hex)) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
    return '128, 128, 128';
  }

  /**
   * Remove loading indicator
   */
  private static removeLoadingIndicator(): void {
    const loadingElement = document.querySelector(`.${WAVEFORM_LOADING_CLASS}`);
    if (loadingElement && loadingElement.parentNode) {
      // Clear animation interval if it exists
      const intervalId = (loadingElement as HTMLElement).dataset.intervalId;
      if (intervalId) {
        clearInterval(parseInt(intervalId));
      }
      
      loadingElement.parentNode.removeChild(loadingElement);
      
      // Only reset currentWaveformContainer if it was pointing to the loading element
      if (this.currentWaveformContainer === loadingElement) {
        this.currentWaveformContainer = null;
      }
    }
  }

  /**
   * Show error indicator when waveform generation fails
   */
  private static showErrorIndicator(): void {
    try {
      const container = document.createElement('div');
      container.className = WAVEFORM_ERROR_CLASS;
      container.style.cssText = `
        padding: 10px;
        background: rgba(255, 0, 0, 0.1);
        border-radius: 4px;
        text-align: center;
        color: #666;
        font-size: 11px;
      `;
      container.textContent = 'Waveform generation failed';

      this.mountInWaveformHost(container);
      this.currentWaveformContainer = container;

      // Auto-remove error after 5 seconds
      setTimeout(() => {
        if (this.currentWaveformContainer === container) {
          this.removeCurrentWaveform();
        }
      }, 5000);
    } catch (error) {
      Logger.error('[WaveformController] Error showing error indicator:', error);
    }
  }

  /**
   * Manually trigger waveform regeneration
   */
  public static regenerateWaveform(): void {
    this.lastAudioSrc = ''; // Reset to force regeneration
    
    // Clear any pending debounced generation
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.generateWaveformIfNeeded();
  }

  /**
   * Preload audio data for the first track on the page
   * This improves user experience by starting waveform processing before playback
   */
  private static async preloadFirstTrackData(): Promise<void> {
    try {
      let firstTrackAudioSrc: string | null = null;

      // Strategy 1: Check if there's already an audio element with a source
      const existingAudio = AudioUtils.getAudioElement();
      if (existingAudio && existingAudio.src) {
        firstTrackAudioSrc = existingAudio.src;
      }

      // Strategy 2: For track/album pages, try to detect first track without playing
      if (!firstTrackAudioSrc && (BandcampFacade.isTrack || BandcampFacade.isAlbum)) {
        const firstPlayButton = document.querySelector('.play-button, .playbutton, [data-bind*="play"]');
        if (firstPlayButton) {
          // We'll preload when the user actually starts playback
          return;
        }
      }

      // Strategy 3: For wishlist pages, try to get first track info
      if (!firstTrackAudioSrc && BandcampFacade.isWishlistPage) {
        try {
          const wishlistItems = BandcampFacade.loadWishlistItems();
          if (wishlistItems && wishlistItems.length > 0) {
            // For wishlist, we'll preload when a track is selected
            return;
          }
        } catch (error) {
          Logger.warn('[WaveformController] Could not load wishlist items for preloading:', error);
        }
      }

      // If we have a source, preload the waveform data
      if (firstTrackAudioSrc) {
        const streamId = WaveformService.extractStreamId(firstTrackAudioSrc);
        if (streamId) {
          // Preload in background without showing UI
          WaveformService.generateWaveformForCurrentAudio()
            .catch((error) => {
              Logger.warn('[WaveformController] Background preload failed (this is non-critical):', error);
            });
        }
      }
    } catch (error) {
      Logger.warn('[WaveformController] Error during preload attempt (non-critical):', error);
    }
  }

  /**
   * Clean up waveform resources
   */
  public static cleanup(): void {
    try {
      // Clear debounce timer
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      
      // Reset generation promise and supersede any in-flight generation so a
      // late-resolving fetch can't re-insert a waveform after we navigated away.
      this.generationToken++;
      this.generationPromise = null;
      this.isGenerating = false;

      // Remove any waveform containers
      this.removeCurrentWaveform();

      // Remove the reserved host slot (re-created on the next supported page)
      document.querySelector(`.${WAVEFORM_HOST_CLASS}`)?.remove();

      // Clear expired cache
      WaveformService.clearExpiredCache();
    } catch (error) {
      Logger.error('[WaveformController] Error during cleanup:', error);
    }
  }

  /**
   * Get current status for debugging
   */
  public static getStatus(): object {
    return {
      isGenerating: this.isGenerating,
      hasCurrentWaveform: !!this.currentWaveformContainer,
      hasGenerationPromise: !!this.generationPromise,
      hasDebounceTimer: this.debounceTimer !== null,
      lastAudioSrc: this.lastAudioSrc,
      pageSupported: this.isPageSupported(),
      cacheStats: WaveformService.getCacheStats(),
      existingContainers: document.querySelectorAll(
        WAVEFORM_ELEMENT_SELECTOR,
      ).length,
    };
  }

  /**
   * Debounced waveform generation to prevent multiple simultaneous generations
   *
   * @param delay Optional delay in milliseconds (default: 300ms)
   */
  private static debouncedGenerateWaveform(delay = 300): void {
    // Clear any existing timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      
      // Check extension context validity before proceeding
      if (!this.isExtensionContextValid()) {
        return;
      }
      
      this.generateWaveformIfNeeded();
    }, delay);
  }
}
