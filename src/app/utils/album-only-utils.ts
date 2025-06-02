import {Logger} from './logger';

/**
 * Utility for detecting album-only purchase restrictions on Bandcamp track pages
 */
export class AlbumOnlyUtils {
  /**
   * Check if the current track page only allows album purchase
   * @returns Object with isAlbumOnly boolean and any detected indicators
   */
  public static checkForAlbumOnlyPurchase(): { isAlbumOnly: boolean; indicators?: string[] } {
    try {
      const pageText = document.body.textContent || '';
      
      // Simple logic: if we can't find "Buy Digital Track", consider it album-only
      const hasIndividualTrackPurchase = pageText.includes('Buy Digital Track');
      const isAlbumOnly = !hasIndividualTrackPurchase;
      
      if (isAlbumOnly) {
        Logger.info('Album-only purchase detected: "Buy Digital Track" text not found on page');
      } else {
        Logger.info('Individual track purchase available: "Buy Digital Track" text found on page');
      }

      return {
        isAlbumOnly,
        indicators: isAlbumOnly ? ['Buy Digital Track not found'] : ['Buy Digital Track found']
      };
    } catch (error) {
      Logger.error('Error checking for album-only purchase:', error);
      return { isAlbumOnly: false };
    }
  }
}
