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
  private static debounceTimer: number | null = null;
  private static generationPromise: Promise<void> | null = null;

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

      // Listen for audio source changes with debouncing
      const checkAudioChanges = () => {
        const audio = AudioUtils.getAudioElement();
        if (audio && audio.src && audio.src !== this.lastAudioSrc) {
          Logger.info('[WaveformController] Audio source changed, scheduling waveform regeneration');
          this.debouncedGenerateWaveform();
        }
      };

      // Check for audio changes periodically
      setInterval(checkAudioChanges, 1000);

      // Listen for loadstart events on audio elements (existing and future)
      document.addEventListener('loadstart', (event) => {
        if (event.target instanceof HTMLAudioElement) {
          Logger.info('[WaveformController] Audio loadstart detected');
          this.debouncedGenerateWaveform(1000);
        }
      }, true);

      // Listen for play events
      document.addEventListener('play', (event) => {
        if (event.target instanceof HTMLAudioElement) {
          Logger.info('[WaveformController] Audio play detected');
          this.debouncedGenerateWaveform(500);
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
      // If a generation is already in progress, wait for it to complete
      if (this.generationPromise) {
        Logger.info('[WaveformController] Waveform generation already in progress, waiting for completion');
        await this.generationPromise;
        return;
      }

      // Check if audio is available and ready
      const audio = AudioUtils.getAudioElement();
      if (!audio || !audio.src) {
        Logger.info('[WaveformController] No audio element or source available');
        return;
      }

      // Skip if audio source hasn't changed and we already have a waveform
      if (audio.src === this.lastAudioSrc && this.currentWaveformContainer && 
          !this.currentWaveformContainer.classList.contains('bandcamp-waveform-loading') &&
          !this.currentWaveformContainer.classList.contains('bandcamp-waveform-error')) {
        Logger.info('[WaveformController] Waveform already generated for current audio');
        return;
      }

      // Create the generation promise to prevent concurrent executions
      this.generationPromise = this.performWaveformGeneration(audio.src);
      await this.generationPromise;
      this.generationPromise = null;

    } catch (error) {
      Logger.error('[WaveformController] Error in generateWaveformIfNeeded:', error);
      this.generationPromise = null;
    }
  }

  /**
   * Perform the actual waveform generation process
   */
  private static async performWaveformGeneration(audioSrc: string): Promise<void> {
    try {
      this.isGenerating = true;
      this.lastAudioSrc = audioSrc;

      Logger.info('[WaveformController] Generating waveform for current audio');

      // Remove existing waveform first
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
      // Get the current audio source for waveform data lookup
      const audio = AudioUtils.getAudioElement();
      if (!audio || !audio.src) {
        Logger.warn('[WaveformController] No audio element available for playhead tracking');
        return;
      }

      const streamId = WaveformService.extractStreamId(audio.src);
      if (!streamId) {
        Logger.warn('[WaveformController] Could not extract stream ID for playhead tracking');
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
      Logger.error('[WaveformController] Error setting up playhead tracking:', error);
    }
  }

  /**
   * Remove the current waveform from the page
   */
  private static removeCurrentWaveform(): void {
    // Remove any existing waveform containers (including loading and error states)
    const existingContainers = document.querySelectorAll(
      '.bandcamp-waveform-container, .bandcamp-waveform-loading, .bandcamp-waveform-error'
    );
    
    existingContainers.forEach(container => {
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
    
    if (existingContainers.length > 0) {
      Logger.info('[WaveformController] Removed', existingContainers.length, 'existing waveform container(s)');
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
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid rgba(190, 190, 190, 0.3);
      `;
      
      // Create loading dots animation
      const loadingText = document.createElement('span');
      loadingText.textContent = 'Generating waveform';
      loadingText.style.cssText = `
        color: #666;
        font-size: 12px;
      `;
      
      const dotsContainer = document.createElement('span');
      dotsContainer.style.cssText = `
        display: inline-block;
        width: 20px;
        text-align: left;
      `;
      
      container.appendChild(loadingText);
      container.appendChild(dotsContainer);
      
      // Animate dots
      let dotCount = 0;
      const animateDots = () => {
        dotCount = (dotCount + 1) % 4;
        dotsContainer.textContent = '.'.repeat(dotCount);
      };
      
      // Start animation and store interval ID on container
      container.dataset.intervalId = setInterval(animateDots, 500).toString();
      animateDots(); // Initial call

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
      
      Logger.info('[WaveformController] Removed loading indicator');
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
      // Clear debounce timer
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      
      // Reset generation promise
      this.generationPromise = null;
      this.isGenerating = false;
      
      // Remove any waveform containers
      this.removeCurrentWaveform();
      
      // Clear expired cache
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
      hasGenerationPromise: !!this.generationPromise,
      hasDebounceTimer: this.debounceTimer !== null,
      lastAudioSrc: this.lastAudioSrc,
      pageSupported: this.isPageSupported(),
      cacheStats: WaveformService.getCacheStats(),
      existingContainers: document.querySelectorAll(
        '.bandcamp-waveform-container, .bandcamp-waveform-loading, .bandcamp-waveform-error'
      ).length
    };
  }

  /**
   * Debounced waveform generation to prevent multiple simultaneous generations
   * @param delay Optional delay in milliseconds (default: 300ms)
   */
  private static debouncedGenerateWaveform(delay: number = 300): void {
    // Clear any existing timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.generateWaveformIfNeeded();
    }, delay);
  }
}
