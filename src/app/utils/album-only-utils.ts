import {Logger} from './logger';

/**
 * Utility for detecting album-only purchase restrictions on Bandcamp track pages
 */
export class AlbumOnlyUtils {
  /**
   * Check if the current track page only allows album purchase
   *
   * @returns Object with isAlbumOnly boolean and any detected indicators
   */
  public static checkForAlbumOnlyPurchase(): {isAlbumOnly: boolean; indicators?: string[];} {
    try {
      // Look only at the purchase section's own buy controls (.buyItem), not the
      // whole page, so the phrase appearing in a review/description/credits can't
      // flip the result. A track is individually purchasable iff its buy section
      // offers a "Digital Track" package.
      const buySection = Array.from(
        document.querySelectorAll('.buyItem .buyItemPackageTitle, .buyItem .buy-link'),
      );
      const hasIndividualTrackPurchase = buySection.some(
        (el) => /digital track/i.test(el.textContent ?? ''),
      );
      const isAlbumOnly = !hasIndividualTrackPurchase;

      return {
        isAlbumOnly,
        indicators: [hasIndividualTrackPurchase
          ? 'Digital Track buy option present'
          : 'No Digital Track buy option in buy section'],
      };
    } catch (error) {
      Logger.error('Error checking for album-only purchase:', error);
      return {isAlbumOnly: false};
    }
  }
}
