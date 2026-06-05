import {Logger} from '../logger';
import {AddToCartUtils} from '../add-to-cart-utils';

/**
 * Adding a wishlist/collection item to the cart (track/album aware).
 * Extracted from add-to-cart-utils.ts; cross-module calls route through the AddToCartUtils facade.
 */
export class AddToCartItems {

  /**
   * Add a wishlist item to cart using the same logic as the 'c' key functionality
   * This method handles both track and album wishlist items appropriately
   *
   * @param item The wishlist item element to add to cart
   * @param options Optional parameters for customization
   * @returns Promise that resolves when the item is successfully processed
   */
  public static async addWishlistItemToCart(
    item: HTMLElement, 
    options: {
      checkNowPlaying?: boolean;
      logPrefix?: string;
      closeTabAfterAdd?: boolean;
    } = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const { 
          checkNowPlaying = false, 
          logPrefix = 'Adding wishlist item to cart',
          closeTabAfterAdd = false
        } = options;
        Logger.debug(logPrefix);
        
        // First priority: Check the now-playing section if requested (for currently playing track)
        if (checkNowPlaying) {
          const nowPlaying = document.querySelector('.now-playing');
          if (nowPlaying) {
            Logger.debug('Found now-playing section, checking for direct add to cart links');
            
            // Look for the add-to-cart link in the now-playing section which should point to the individual track
            const nowPlayingAddToCartLink = AddToCartUtils.findAddToCartLinkInContainer(nowPlaying as HTMLElement);
            if (nowPlayingAddToCartLink) {
              Logger.debug('Found add to cart link in now-playing section, using this');
              const href = (nowPlayingAddToCartLink as HTMLAnchorElement).href;
              AddToCartUtils.openAddToCartLinkWithCart(href, closeTabAfterAdd);
              resolve();
              return;
            }
            
            // If no add to cart link, try the track URL from the title
            const nowPlayingTrackLink = nowPlaying.querySelector('.title');
            if (nowPlayingTrackLink) {
              const trackLinkParent = nowPlayingTrackLink.closest('a');
              if (trackLinkParent) {
                Logger.debug('Found track link in now-playing section, using this instead');
                const href = (trackLinkParent as HTMLAnchorElement).href;
                AddToCartUtils.openAddToCartLinkWithCart(href, closeTabAfterAdd);
                resolve();
                return;
              }
            }
          }
        }
        
        // Find the track/album URL directly without checking for add-to-cart links in the item
        // For bulk mode, we need to extract the correct track URL from the wishlist item itself
        // rather than relying on the now-playing section
        const itemType = item.getAttribute('data-itemtype');
        const trackId = item.getAttribute('data-trackid') || item.getAttribute('data-track-id');
        const tralbumId = item.getAttribute('data-tralbumid');
        const bandId = item.getAttribute('data-bandid');
        const trackTitle = item.getAttribute('data-title');
        
        // First, try to find direct track links in the wishlist item
        let trackLink = item.querySelector('a[href*="/track/"]:not([href*="action="])') as HTMLAnchorElement;
        
        // If we found a direct track link, use it
        if (trackLink && trackLink.href) {
          Logger.debug('Opening direct track link:', trackLink.href);
          AddToCartUtils.openAddToCartLinkWithCart(trackLink.href, closeTabAfterAdd);
          resolve();
          return;
        }
        
        // For track items, construct direct track URLs from the album domain and track title
        if (itemType === 'track' && trackId && trackTitle) {
          // Filter out action/gift links to get clean album links
          const cleanLinks = Array.from(item.querySelectorAll('a[href]'))
            .filter(link => {
              const href = (link as HTMLAnchorElement).href;
              return !href.includes('action=gift') && !href.includes('action=');
            }) as HTMLAnchorElement[];
          
          // Check if we already have a direct track link (rare but possible)
          const directTrackLink = cleanLinks.find(link => link.href.includes('/track/'));
          if (directTrackLink) {
            Logger.debug('Opening direct track link:', directTrackLink.href);
            AddToCartUtils.openAddToCartLinkWithCart(directTrackLink.href, closeTabAfterAdd);
            resolve();
            return;
          }
          
          // Construct direct track URL from album link and track title
          const albumLink = cleanLinks.find(link => link.href.includes('/album/'));
          if (albumLink) {
            const url = new URL(albumLink.href);
            // Best-effort match for Bandcamp's slug: strip accents (Café -> cafe)
            // before dropping non-word characters, so non-ASCII titles don't
            // collapse to an empty/garbled slug.
            const trackSlug = trackTitle
              .normalize('NFKD')
              .replace(/[̀-ͯ]/g, '')
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w-]/g, '')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');
            const directTrackUrl = `${url.origin}/track/${trackSlug}`;
            Logger.debug('Opening constructed track URL:', directTrackUrl);
            AddToCartUtils.openAddToCartLinkWithCart(directTrackUrl, closeTabAfterAdd);
            resolve();
            return;
          }
          
          Logger.warn('No valid album link found for track item');
        }
        // Only use album links for actual album items, not for tracks
        if (itemType === 'album' && !trackLink) {
          // For album items, we can fall back to the album link
          trackLink = item.querySelector('a[href*="/album/"]') as HTMLAnchorElement;
        }

        // For track items, if we haven't found a direct track link or constructed one,
        // we should NOT fall back to album links - this is the core issue we're fixing
        if (itemType === 'track' && !trackLink) {
          Logger.warn('No valid track link found for track item');
          reject(new Error('No valid track link found for track item'));
          return;
        }
        
        if (trackLink && trackLink.href) {
          Logger.debug('Opening item page:', trackLink.href);
          AddToCartUtils.openAddToCartLinkWithCart(trackLink.href, closeTabAfterAdd);
          resolve();
          return;
        }

        // If we reach here, we couldn't find a valid link for this item
        Logger.error('No valid link found for wishlist item');
        reject(new Error('No valid link found for wishlist item'));
        return;
      } catch (error) {
        reject(error);
      }
    });
  }
}
