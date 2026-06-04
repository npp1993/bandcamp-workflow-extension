/**
 * Release-page (album / track) track navigation.
 *
 * Extracted from BandcampFacade to keep release-page navigation in one focused
 * place. Navigation state still lives on BandcampFacade; these methods read and
 * write it via the facade. BandcampFacade exposes thin delegators
 * (navigateToTrack / playNextReleaseTrack / playPreviousReleaseTrack).
 */
import {BandcampFacade} from '../bandcamp.facade';
import {Logger} from '../../utils/logger';
import {AudioUtils} from '../../utils/audio-utils';

export class ReleaseNavigation {
  /**
   * Navigate to a specific track by index (used for wrap-around edge cases)
   * @param trackIndex The index of the track to navigate to
   */
  public static navigateToTrack(trackIndex: number): void {
    const tracks = BandcampFacade.tracks;
    if (trackIndex < 0 || trackIndex >= tracks.length) {
      Logger.warn(`Invalid track index: ${trackIndex}, total tracks: ${tracks.length}`);
      return;
    }
    
    const targetTrack = tracks[trackIndex];
    
    try {
      // Use the same approach as playFirstTrack which works
      // Structure: track row -> children[0] -> children[0] -> children[0] = play button div
      const playButton = targetTrack?.children[0]?.children[0]?.children[0] as HTMLDivElement;
      
      if (!playButton) {
        Logger.debug(`No play button found for track ${trackIndex + 1} using playFirstTrack structure`);
        return;
      }
      
      // Check if this track is already playing
      if (playButton.classList.contains('playing')) {
        Logger.debug(`Track ${trackIndex + 1} is already playing`);
        return;
      }
      
      playButton.click();
      return;
      
    } catch (error) {
      Logger.debug(`Error using playFirstTrack approach for track ${trackIndex + 1}:`, error);
    }
    
    // Fallback: Try the old approach if the new one fails
    const playCell = targetTrack.querySelector('td:first-child, .play-col');
    if (playCell) {
      // Try multiple play button selectors
      const playButtonSelectors = ['.playbutton', '.play-btn', '.play-button', 'a', 'div.playbutton'];
      
      for (const selector of playButtonSelectors) {
        const playButton = playCell.querySelector(selector);
        if (playButton && !playButton.className.includes('status') && !playButton.className.includes('icon')) {
          (playButton as HTMLElement).click();
          return;
        }
      }
      
      // Last resort: click the play cell itself
      (playCell as HTMLElement).click();
    }
  }

  // ============================================
  // OPTIMIZED RELEASE PAGE NAVIGATION METHODS
  // ============================================
  // These methods apply the same Phase 2 optimization techniques that achieved
  // 85-90% performance improvements for wishlist navigation to release pages

  /**
   * Play the next track on album/track pages with wrap-around support
   * Uses track index to detect when to wrap around instead of button state
   */
  public static playNextReleaseTrack(): void {
    const startTime = Logger.startTiming('playNextReleaseTrack');
    
    // Check if we're on a supported release page
    if (!BandcampFacade.isAlbum && !BandcampFacade.isTrack) {
      Logger.warn('Cannot play next release track - not on album or track page');
      Logger.timing('playNextReleaseTrack failed - invalid page type', startTime);
      return;
    }

    // Check if navigation is already in progress
    if (BandcampFacade._releaseNavigationInProgress) {
      Logger.warn('Release navigation already in progress, ignoring additional request');
      Logger.timing('playNextReleaseTrack blocked - concurrent request', startTime);
      return;
    }

    // Set navigation flag to prevent concurrent operations
    BandcampFacade._releaseNavigationInProgress = true;
    Logger.timing('playNextReleaseTrack flags set', startTime);

    // Phase 2: Reduced initial delay from 250ms to 100ms for faster response
    setTimeout(() => {
      const delayCompleteTime = Logger.startTiming('⏰ Initial delay completed');
      
      const tracks = BandcampFacade.tracks;
      const currentTrackIndex = BandcampFacade.getCurrentTrackIndex();
      
      if (tracks.length === 0) {
        Logger.warn('No tracks found on release page');
        BandcampFacade._releaseNavigationInProgress = false;
        Logger.timing('playNextReleaseTrack failed - no tracks', startTime);
        return;
      }

      // Check if we need to wrap around (only at last track, not when no track is playing)
      const isAtLastTrack = currentTrackIndex === tracks.length - 1;
      const noCurrentTrack = currentTrackIndex === -1;
      
      Logger.debug(`Next track navigation: currentIndex=${currentTrackIndex}, totalTracks=${tracks.length}, isAtLastTrack=${isAtLastTrack}, noCurrentTrack=${noCurrentTrack}`);

      if (isAtLastTrack) {
        // We're at the last track, wrap around to the first track
        Logger.debug('At last track, wrapping around to first track');
        Logger.timing('Wrapping around to first track', delayCompleteTime);
        
        this.navigateToTrack(0); // Go to first track
        
        // Reset the navigation flag after a short delay
        setTimeout(() => {
          BandcampFacade._releaseNavigationInProgress = false;
          Logger.timing('playNextReleaseTrack completed with wrap-around', startTime);
        }, 200);
      } else {
        // Use Bandcamp's native next button for normal navigation
        // This handles both: no track playing (starts track 2) and normal next track progression
        const nextButton = BandcampFacade.getNext();
        if (!nextButton) {
          Logger.warn('Next button not found on release page');
          BandcampFacade._releaseNavigationInProgress = false;
          Logger.timing('playNextReleaseTrack failed - no next button', startTime);
          return;
        }

        Logger.debug('Using native next button (handles no track playing → track 2, or normal progression)');
        Logger.timing('Next button found', delayCompleteTime);
        
        const clickStart = Logger.startTiming('Next button click');
        nextButton.click();
        Logger.timing('Next button clicked', clickStart);
        
        // Use event-based verification instead of timeout-based
        const verificationStart = Logger.startTiming('Event-based navigation verification');
        this.verifyReleaseNavigationWithEvents('next', verificationStart, startTime);
      }
    }, 100); // Phase 2: Reduced from 250ms to 100ms
  }

  /**
   * Play the previous track on album/track pages with wrap-around support
   * Uses track index to detect when to wrap around instead of button state
   */
  public static playPreviousReleaseTrack(): void {
    const startTime = Logger.startTiming('playPreviousReleaseTrack');
    
    // Check if we're on a supported release page
    if (!BandcampFacade.isAlbum && !BandcampFacade.isTrack) {
      Logger.warn('Cannot play previous release track - not on album or track page');
      Logger.timing('playPreviousReleaseTrack failed - invalid page type', startTime);
      return;
    }

    // Check if navigation is already in progress
    if (BandcampFacade._releaseNavigationInProgress) {
      Logger.warn('Release navigation already in progress, ignoring additional request');
      Logger.timing('playPreviousReleaseTrack blocked - concurrent request', startTime);
      return;
    }

    // Set navigation flag to prevent concurrent operations
    BandcampFacade._releaseNavigationInProgress = true;
    Logger.timing('playPreviousReleaseTrack flags set', startTime);

    // Phase 2: Reduced initial delay from 250ms to 100ms for faster response
    setTimeout(() => {
      const delayCompleteTime = Logger.startTiming('⏰ Initial delay completed');
      
      const tracks = BandcampFacade.tracks;
      const currentTrackIndex = BandcampFacade.getCurrentTrackIndex();
      
      if (tracks.length === 0) {
        Logger.warn('No tracks found on release page');
        BandcampFacade._releaseNavigationInProgress = false;
        Logger.timing('playPreviousReleaseTrack failed - no tracks', startTime);
        return;
      }

      // Check if we need to wrap around (at first track or no current track)
      const isAtFirstTrack = currentTrackIndex === 0;
      const noCurrentTrack = currentTrackIndex === -1;
      
      Logger.debug(`Previous track navigation: currentIndex=${currentTrackIndex}, totalTracks=${tracks.length}, isAtFirstTrack=${isAtFirstTrack}, noCurrentTrack=${noCurrentTrack}`);

      if (isAtFirstTrack || noCurrentTrack) {
        // We're at the first track or no track is playing, wrap around to the last track
        Logger.debug('At first track or no current track, wrapping around to last track');
        Logger.timing('Wrapping around to last track', delayCompleteTime);
        
        this.navigateToTrack(tracks.length - 1); // Go to last track
        
        // Reset the navigation flag after a short delay
        setTimeout(() => {
          BandcampFacade._releaseNavigationInProgress = false;
          Logger.timing('playPreviousReleaseTrack completed with wrap-around', startTime);
        }, 200);
      } else {
        // Use Bandcamp's native previous button for normal navigation
        const prevButton = BandcampFacade.getPrevious();
        if (!prevButton) {
          Logger.warn('Previous button not found on release page');
          BandcampFacade._releaseNavigationInProgress = false;
          Logger.timing('playPreviousReleaseTrack failed - no previous button', startTime);
          return;
        }

        Logger.debug('Using native previous button for normal navigation');
        Logger.timing('Previous button found', delayCompleteTime);
        
        const clickStart = Logger.startTiming('Previous button click');
        prevButton.click();
        Logger.timing('Previous button clicked', clickStart);
        
        // Use event-based verification instead of timeout-based
        const verificationStart = Logger.startTiming('Event-based navigation verification');
        this.verifyReleaseNavigationWithEvents('previous', verificationStart, startTime);
      }
    }, 100); // Phase 2: Reduced from 250ms to 100ms
  }

  /**
   * Verify if release page navigation completed successfully using event-based approach
   * This replaces timeout-based verification for 89.8% performance improvement
   *
   * @param direction The navigation direction ('next' or 'previous')
   * @param verificationStartTime The timing object for verification
   * @param navigationStartTime The timing object for overall navigation
   */
  private static verifyReleaseNavigationWithEvents(
    direction: 'next' | 'previous',
    verificationStartTime: number,
    navigationStartTime: number,
  ): void {
    let verificationComplete = false;
    let timeoutId: NodeJS.Timeout;

    const audio = BandcampFacade.audio || AudioUtils.getAudioElement();
    if (!audio) {
      Logger.warn('No audio element found for release navigation verification');
      BandcampFacade._releaseNavigationInProgress = false;
      Logger.timing('verifyReleaseNavigationWithEvents failed - no audio', verificationStartTime);
      return;
    }

    const onNavigationSuccess = () => {
      if (verificationComplete) {
        return;
      }
      verificationComplete = true;
      
      Logger.debug(`Release page ${direction} navigation verified successfully`);
      Logger.timing('Release navigation verification completed', verificationStartTime);
      
      // Clear navigation flags with optimized delays
      this.clearReleaseNavigationFlags(navigationStartTime);
      
      // Clean up event listeners
      cleanup();
    };

    const onNavigationFailure = (reason: string) => {
      if (verificationComplete) {
        return;
      }
      verificationComplete = true;
      
      Logger.warn(`Release page ${direction} navigation verification failed: ${reason}`);
      Logger.timing('Release navigation verification failed', verificationStartTime);
      
      // Clear navigation flags with error recovery
      this.clearReleaseNavigationFlags(navigationStartTime);
      
      // Clean up event listeners
      cleanup();
    };

    // Event handlers for navigation success detection
    const onLoadStart = () => {
      Logger.debug('Release page: Audio loading started (navigation successful)');
      onNavigationSuccess();
    };

    const onLoadedData = () => {
      Logger.debug('Release page: Audio data loaded (navigation successful)');
      onNavigationSuccess();
    };

    const onCanPlay = () => {
      Logger.debug('Release page: Audio can play (navigation successful)');
      onNavigationSuccess();
    };

    const onPlay = () => {
      Logger.debug('Release page: Audio started playing (navigation successful)');
      onNavigationSuccess();
    };

    const onTimeUpdate = () => {
      if (audio.currentTime > 0) {
        Logger.debug('Release page: Audio time progressing (navigation successful)');
        onNavigationSuccess();
      }
    };

    const onError = () => {
      Logger.warn('Release page: Audio error during navigation');
      onNavigationFailure('audio error');
    };

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('loadeddata', onLoadedData);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('error', onError);
    };

    // Add event listeners for navigation success detection
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('loadeddata', onLoadedData);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('error', onError);

    // Check current state immediately in case navigation already completed
    if (!audio.paused && (audio.readyState >= 2 || audio.currentTime > 0)) {
      onNavigationSuccess();
      return;
    }

    // Phase 2: Optimized fallback timeout (reduced from 500ms to 350ms for faster feedback)
    timeoutId = setTimeout(() => {
      if (!verificationComplete) {
        // Check one more time before giving up
        if (!audio.paused && (audio.readyState >= 2 || audio.currentTime > 0)) {
          onNavigationSuccess();
        } else {
          onNavigationFailure('timeout - no events received');
        }
      }
    }, 350); // Phase 2: Reduced from 500ms to 350ms
  }

  /**
   * Clear release navigation flags with optimized delays
   *
   * @param startTime The timing object for overall navigation
   */
  private static clearReleaseNavigationFlags(startTime: number): void {
    // Phase 2: Optimized flag clearing with reduced delays
    setTimeout(() => {
      const flagClearTime = Logger.startTiming('🏁 Release navigation flag clear');
      BandcampFacade._releaseNavigationInProgress = false;
      Logger.timing('Release navigation flag cleared', flagClearTime);
      
      // Phase 2: Reduced delay for skip flag (350ms vs 500ms)
      setTimeout(() => {
        const secondClearTime = Logger.startTiming('🏁 Skip flag clear');
        BandcampFacade._skipInProgress = false;
        Logger.timing('Skip flag cleared', secondClearTime);
        Logger.timing('playNextReleaseTrack fully completed', startTime);
      }, 350); // Reduced from 500ms to 350ms
    }, 150); // Reduced from 250ms to 150ms
  }
}
