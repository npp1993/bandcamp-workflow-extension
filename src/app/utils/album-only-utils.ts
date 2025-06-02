import {Logger} from './logger';

/**
 * Utility for detecting album-only purchase restrictions on Bandcamp track pages
 */
export class AlbumOnlyUtils {
  /**
   * Common indicators that a track page only allows album purchase
   */
  private static readonly ALBUM_ONLY_INDICATORS = [
    'Buy the Full Digital Album',
    'Buy the Full Album',
    'Buy Full Digital Album',
    'Buy Digital Album',
    'Digital Album',
    'Full Album',
    'Full Digital Album',
    'entire album',
    'whole album',
    'complete album',
    'album only',
    'not available as individual track',
    'track not available for purchase',
    'only available as part of',
    'purchase the album',
    'get the album',
    'Album Only'
  ];

  /**
   * Check if the current track page only allows album purchase
   * @returns Object with isAlbumOnly boolean and any detected indicators
   */
  public static checkForAlbumOnlyPurchase(): { isAlbumOnly: boolean; indicators?: string[] } {
    try {
      const pageText = document.body.textContent || '';
      const foundIndicators: string[] = [];

      // Check for album-only indicators in the page text
      for (const indicator of AlbumOnlyUtils.ALBUM_ONLY_INDICATORS) {
        if (pageText.includes(indicator)) {
          foundIndicators.push(indicator);
        }
      }

      const isAlbumOnly = foundIndicators.length > 0;
      
      if (isAlbumOnly) {
        Logger.info(`Album-only purchase detected. Found indicators: ${foundIndicators.join(', ')}`);
      } else {
        Logger.info('No album-only purchase restrictions detected');
      }

      return {
        isAlbumOnly,
        indicators: foundIndicators.length > 0 ? foundIndicators : undefined
      };
    } catch (error) {
      Logger.error('Error checking for album-only purchase:', error);
      return { isAlbumOnly: false };
    }
  }
}
