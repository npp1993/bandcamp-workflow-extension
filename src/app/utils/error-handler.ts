import { Logger } from './logger';

/**
 * Utility for common error handling patterns in the extension
 */
export class ErrorHandler {
  /**
   * Handle audio playback errors with standard retry logic
   */
  public static handleAudioError(
    error: MediaError | null, 
    trackId: string | null,
    onSkip: () => void,
    isWishlistPage: boolean = false
  ): void {
    if (trackId) {
      Logger.info(`Adding track ID ${trackId} to problem list due to playback error`);
    }

    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_NETWORK:
          Logger.debug('Network error detected, attempting to reload audio');
          this.scheduleSkip(onSkip, 500);
          break;
          
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        case MediaError.MEDIA_ERR_DECODE:
          Logger.debug('Media format error detected, skipping to next track immediately');
          this.scheduleSkip(onSkip, 500);
          break;
          
        default:
          Logger.debug('Unrecoverable audio error, skipping to next track');
          this.scheduleSkip(onSkip, 500);
          break;
      }
    } else {
      Logger.debug('Unrecoverable audio error, skipping to next track');
      this.scheduleSkip(onSkip, 500);
    }
  }

  /**
   * Schedule a skip operation with a delay
   */
  private static scheduleSkip(onSkip: () => void, delay: number): void {
    setTimeout(() => {
      onSkip();
    }, delay);
  }

  /**
   * Execute an operation with error handling
   */
  public static withErrorHandling<T>(
    operation: () => T, 
    errorMessage: string, 
    fallback?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      Logger.error(errorMessage, error);
      return fallback;
    }
  }
}
