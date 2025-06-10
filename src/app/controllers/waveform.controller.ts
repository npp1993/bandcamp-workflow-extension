import { WaveformService } from '../services/waveform.service';
import { BandcampFacade } from '../facades/bandcamp.facade';
import { AudioUtils } from '../utils/audio-utils';
import { SeekUtils } from '../utils/seek-utils';
import { Logger } from '../utils/logger';

/**
 * Controller for waveform integration with Bandcamp pages
 * Handles UI integration and lifecycle management
 */
export class WaveformController {
  private static currentWaveformContainer: HTMLElement | null = null;
  private static isGenerating = false;
  private static lastAudioSrc = '';

  /**
   * Initialize waveform functionality on the current page
   */
  public static initialize(): void {
    try {
      Logger.info('[WaveformController] Initializing waveform functionality');
      
      // Only initialize on supported page types
      if (!this.isPageSupported()) {
        Logger.info('[WaveformController] Page type not supported for waveforms');
        return;
      }

      // Set up audio event listeners to detect track changes
      this.setupAudioEventListeners();

      // Generate initial waveform if audio is already present
      this.generateWaveformIfNeeded();

      Logger.info('[WaveformController] Waveform functionality initialized');
    } catch (error) {
      Logger.error('[WaveformController] Error initializing waveform functionality:', error);
    }
  }

  /**
   * Check if the current page supports waveform display
   * @returns True if page supports waveforms
   */
  private static isPageSupported(): boolean {
    // Support track, album, and wishlist pages
    return BandcampFacade.isTrack || BandcampFacade.isAlbum || BandcampFacade.isWishlistPage;
  }

  /**
   * Set up event listeners to detect audio changes and regenerate waveforms
   */
  private static setupAudioEventListeners(): void {
    try {
      Logger.info('[WaveformController] Setting up audio event listeners');

      // Listen for audio source changes
      const checkAudioChanges = () => {
        const audio = AudioUtils.getAudioElement();
        if (audio && audio.src && audio.src !== this.lastAudioSrc) {
          Logger.info('[WaveformController] Audio source changed, regenerating waveform');
          this.lastAudioSrc = audio.src;
          // Add a small delay to ensure audio is ready
          setTimeout(() => this.generateWaveformIfNeeded(), 500);
        }
      };

      // Check for audio changes periodically
      setInterval(checkAudioChanges, 1000);

      // Listen for loadstart events on audio elements (existing and future)
      document.addEventListener('loadstart', (event) => {
        if (event.target instanceof HTMLAudioElement) {
          Logger.info('[WaveformController] Audio loadstart detected');
          setTimeout(() => this.generateWaveformIfNeeded(), 1000);
        }
      }, true);

      // Listen for play events
      document.addEventListener('play', (event) => {
        if (event.target instanceof HTMLAudioElement) {
          Logger.info('[WaveformController] Audio play detected');
          setTimeout(() => this.generateWaveformIfNeeded(), 500);
        }
      }, true);

    } catch (error) {
      Logger.error('[WaveformController] Error setting up audio event listeners:', error);
    }
  }

  /**
   * Generate waveform if conditions are met
   */
  private static async generateWaveformIfNeeded(): Promise<void> {
    try {
      // Prevent multiple simultaneous generations
      if (this.isGenerating) {
        Logger.info('[WaveformController] Waveform generation already in progress');
        return;
      }

      // Check if audio is available and ready
      const audio = AudioUtils.getAudioElement();
      if (!audio || !audio.src) {
        Logger.info('[WaveformController] No audio element or source available');
        return;
      }

      // Skip if audio source hasn't changed and we already have a waveform
      if (audio.src === this.lastAudioSrc && this.currentWaveformContainer) {
        Logger.info('[WaveformController] Waveform already generated for current audio');
        return;
      }

      this.isGenerating = true;
      this.lastAudioSrc = audio.src;

      Logger.info('[WaveformController] Generating waveform for current audio');

      // Remove existing waveform
      this.removeCurrentWaveform();

      // Show loading indicator
      this.showLoadingIndicator();

      // Generate the waveform
      const waveformCanvas = await WaveformService.generateWaveformForCurrentAudio();

      // Remove loading indicator
      this.removeLoadingIndicator();

      if (waveformCanvas) {
        // Insert the waveform into the page
        this.insertWaveform(waveformCanvas);
        Logger.info('[WaveformController] Successfully generated and inserted waveform');
      } else {
        Logger.warn('[WaveformController] Failed to generate waveform');
        this.showErrorIndicator();
      }

    } catch (error) {
      Logger.error('[WaveformController] Error generating waveform:', error);
      this.removeLoadingIndicator();
      this.showErrorIndicator();
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Insert waveform canvas into the page using BandcampFacade
   * @param canvas Waveform canvas element
   */
  private static insertWaveform(canvas: HTMLCanvasElement): void {
    try {
      // Create container for the waveform
      const container = document.createElement('div');
      container.className = 'bandcamp-waveform-container';
      container.style.cssText = `
        margin: 10px 0;
        padding: 10px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        text-align: center;
        position: relative;
        cursor: pointer;
      `;

      // Add canvas to container
      container.appendChild(canvas);

      // Set up click-to-seek functionality
      this.setupClickToSeek(container, canvas);

      // Set up playhead position tracking
      this.setupPlayheadTracking(container, canvas);

      // Use BandcampFacade to insert below player
      BandcampFacade.insertBelowPlayer(container);
      
      this.currentWaveformContainer = container;

      Logger.info('[WaveformController] Waveform inserted below player');
    } catch (error) {
      Logger.error('[WaveformController] Error inserting waveform:', error);
    }
  }

  /**
   * Set up click-to-seek functionality for the waveform
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
        
        Logger.info('[WaveformController] Seeking to position:', clampedRatio);
      } catch (error) {
        Logger.error('[WaveformController] Error in click-to-seek:', error);
      }
    });
  }

  /**
   * Set up playhead position tracking for the waveform
   * @param container Waveform container element
   * @param canvas Waveform canvas element
   */
  private static setupPlayheadTracking(container: HTMLElement, canvas: HTMLCanvasElement): void {
    try {
      // Create playhead overlay
      const playheadOverlay = document.createElement('div');
      playheadOverlay.className = 'bandcamp-waveform-playhead';
      playheadOverlay.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        bottom: 10px;
        background: rgba(255, 255, 255, 0.3);
        pointer-events: none;
        transition: width 0.1s ease;
        width: 0%;
      `;
      
      container.appendChild(playheadOverlay);

      // Set up audio time update listener
      const updatePlayhead = () => {
        const audio = AudioUtils.getAudioElement();
        if (audio && !isNaN(audio.duration) && audio.duration > 0) {
          const progress = (audio.currentTime / audio.duration) * 100;
          playheadOverlay.style.width = `${progress}%`;
        }
      };

      // Add event listener to audio element
      const audio = AudioUtils.getAudioElement();
      if (audio) {
        audio.addEventListener('timeupdate', updatePlayhead);
        
        // Store reference for cleanup
        container.setAttribute('data-timeupdate-listener', 'true');
        (container as any)._timeUpdateListener = updatePlayhead;
        (container as any)._audioElement = audio;
      }

      // Initial update
      updatePlayhead();
      
    } catch (error) {
      Logger.error('[WaveformController] Error setting up playhead tracking:', error);
    }
  }

  /**
   * Remove the current waveform from the page
   */
  private static removeCurrentWaveform(): void {
    if (this.currentWaveformContainer && this.currentWaveformContainer.parentNode) {
      // Clean up event listeners
      if (this.currentWaveformContainer.getAttribute('data-timeupdate-listener')) {
        const listener = (this.currentWaveformContainer as any)._timeUpdateListener;
        const audioElement = (this.currentWaveformContainer as any)._audioElement;
        if (listener && audioElement) {
          audioElement.removeEventListener('timeupdate', listener);
        }
      }
      
      this.currentWaveformContainer.parentNode.removeChild(this.currentWaveformContainer);
      this.currentWaveformContainer = null;
      Logger.info('[WaveformController] Removed existing waveform');
    }
  }

  /**
   * Show loading indicator while waveform is being generated
   */
  private static showLoadingIndicator(): void {
    try {
      const container = document.createElement('div');
      container.className = 'bandcamp-waveform-loading';
      container.style.cssText = `
        margin: 10px 0;
        padding: 15px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        text-align: center;
        color: #666;
        font-size: 12px;
        border: 1px solid rgba(190, 190, 190, 0.3);
      `;
      
      container.textContent = 'Generating waveform...';

      BandcampFacade.insertBelowPlayer(container);
      this.currentWaveformContainer = container;
    } catch (error) {
      Logger.error('[WaveformController] Error showing loading indicator:', error);
    }
  }

  /**
   * Remove loading indicator
   */
  private static removeLoadingIndicator(): void {
    const loadingElement = document.querySelector('.bandcamp-waveform-loading');
    if (loadingElement && loadingElement.parentNode) {
      loadingElement.parentNode.removeChild(loadingElement);
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
      container.className = 'bandcamp-waveform-error';
      container.style.cssText = `
        margin: 10px 0;
        padding: 10px;
        background: rgba(255, 0, 0, 0.1);
        border-radius: 4px;
        text-align: center;
        color: #666;
        font-size: 11px;
      `;
      container.textContent = 'Waveform generation failed';

      BandcampFacade.insertBelowPlayer(container);
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
    Logger.info('[WaveformController] Manually regenerating waveform');
    this.lastAudioSrc = ''; // Reset to force regeneration
    this.generateWaveformIfNeeded();
  }

  /**
   * Preload audio data for the first track on the page
   * This improves user experience by starting waveform processing before playback
   */
  private static async preloadFirstTrackData(): Promise<void> {
    try {
      Logger.info('[WaveformController] Attempting to preload first track data');
      
      let firstTrackAudioSrc: string | null = null;

      // Strategy 1: Check if there's already an audio element with a source
      const existingAudio = AudioUtils.getAudioElement();
      if (existingAudio && existingAudio.src) {
        firstTrackAudioSrc = existingAudio.src;
        Logger.info('[WaveformController] Found existing audio source for preloading:', firstTrackAudioSrc);
      }

      // Strategy 2: For track/album pages, try to detect first track without playing
      if (!firstTrackAudioSrc && (BandcampFacade.isTrack || BandcampFacade.isAlbum)) {
        const firstPlayButton = document.querySelector('.play-button, .playbutton, [data-bind*="play"]');
        if (firstPlayButton) {
          Logger.info('[WaveformController] Found first play button, will preload when track starts');
          // We'll preload when the user actually starts playback
          return;
        }
      }

      // Strategy 3: For wishlist pages, try to get first track info
      if (!firstTrackAudioSrc && BandcampFacade.isWishlistPage) {
        try {
          const wishlistItems = BandcampFacade.loadWishlistItems();
          if (wishlistItems && wishlistItems.length > 0) {
            Logger.info('[WaveformController] Wishlist page detected, preloading will occur on track selection');
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
          Logger.info('[WaveformController] Starting background preload for stream:', streamId);
          
          // Preload in background without showing UI
          WaveformService.generateWaveformForCurrentAudio()
            .then(canvas => {
              if (canvas) {
                Logger.info('[WaveformController] Successfully preloaded waveform data');
              } else {
                Logger.info('[WaveformController] Preload completed but no waveform generated (likely cached or error)');
              }
            })
            .catch(error => {
              Logger.warn('[WaveformController] Background preload failed (this is non-critical):', error);
            });
        }
      } else {
        Logger.info('[WaveformController] No audio source available for preloading, will generate on demand');
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
      this.removeCurrentWaveform();
      WaveformService.clearExpiredCache();
      Logger.info('[WaveformController] Cleaned up waveform resources');
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
      lastAudioSrc: this.lastAudioSrc,
      pageSupported: this.isPageSupported(),
      cacheStats: WaveformService.getCacheStats()
    };
  }
}
