import { SEEK_STEP } from '../constants';
import { AudioUtils } from './audio-utils';
import { Logger } from './logger';

/**
 * Utility for audio seeking operations
 */
export class SeekUtils {
  /**
   * Seek to the beginning of the track
   */
  public static seekReset(isWishlistPage: boolean = false): void {
    try {
      const audioElement = isWishlistPage 
        ? AudioUtils.getWishlistAudioElement()
        : AudioUtils.getAudioElement();

      if (!audioElement) {
        Logger.warn('No audio element found for seek reset operation');
        return;
      }

      audioElement.currentTime = 0;
      this.updateProgressUI(audioElement, isWishlistPage);
      
      Logger.debug('Seeking to start of track');
    } catch (error) {
      Logger.error('Error in seekReset:', error);
    }
  }

  /**
   * Seek forward by the defined step
   */
  public static seekForward(isWishlistPage: boolean = false): void {
    try {
      const audioElement = isWishlistPage 
        ? AudioUtils.getWishlistAudioElement()
        : AudioUtils.getAudioElement();

      if (!audioElement) {
        Logger.warn('No audio element found for seek forward operation');
        return;
      }

      audioElement.currentTime += SEEK_STEP;
      this.updateProgressUI(audioElement, isWishlistPage);
    } catch (error) {
      Logger.error('Error in seekForward:', error);
    }
  }

  /**
   * Seek backward by the defined step
   */
  public static seekBackward(isWishlistPage: boolean = false): void {
    try {
      const audioElement = isWishlistPage 
        ? AudioUtils.getWishlistAudioElement()
        : AudioUtils.getAudioElement();

      if (!audioElement) {
        Logger.warn('No audio element found for seek backward operation');
        return;
      }

      audioElement.currentTime -= SEEK_STEP;
      this.updateProgressUI(audioElement, isWishlistPage);
    } catch (error) {
      Logger.error('Error in seekBackward:', error);
    }
  }

  /**
   * Seek to a specific position in the track based on ratio (0-1)
   * @param ratio Position ratio (0 = start, 1 = end)
   * @param isWishlistPage Whether we're on a wishlist page
   */
  public static seekToRatio(ratio: number, isWishlistPage: boolean = false): void {
    try {
      const audioElement = isWishlistPage 
        ? AudioUtils.getWishlistAudioElement()
        : AudioUtils.getAudioElement();

      if (!audioElement) {
        Logger.warn('No audio element found for seek to ratio operation');
        return;
      }

      // Ensure ratio is between 0 and 1
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      
      // Set the current time if audio has a valid duration
      if (!isNaN(audioElement.duration)) {
        const newTime = clampedRatio * audioElement.duration;
        audioElement.currentTime = newTime;
        
        this.updateProgressUI(audioElement, isWishlistPage);
        
        Logger.debug(`Set audio position to ${newTime.toFixed(1)}s (${(clampedRatio * 100).toFixed(0)}%)`);
      } else {
        Logger.warn('Cannot seek - audio duration is not available');
      }
    } catch (error) {
      Logger.error('Error in seekToRatio:', error);
    }
  }

  /**
   * Update progress bar UI after seek operation
   */
  private static updateProgressUI(audioElement: HTMLAudioElement, isWishlistPage: boolean): void {
    const progressBar = isWishlistPage 
      ? AudioUtils.getWishlistProgressBar()
      : AudioUtils.getProgressBar();
      
    if (progressBar) {
      AudioUtils.forceUIUpdate(audioElement);
    }
  }
}
