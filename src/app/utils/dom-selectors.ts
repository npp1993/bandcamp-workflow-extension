/**
 * Utility for common DOM selector patterns used throughout the extension
 */
export class DOMSelectors {
  /**
   * Discovery page item selectors
   */
  public static readonly DISCOVERY_ITEMS = [
    '.discover-item', 
    '.discovery-item', 
    '.discover-results .item',
    '.discover-results li',
    '.item[data-item-id]',
  ];

  /**
   * Featured discovery item selectors
   */
  public static readonly FEATURED_DISCOVERY_ITEMS = [
    '.featured-item', 
    '.discover-featured .item',
    '.featured-items .item',
    '.featured',
  ];

  /**
   * Wishlist item selectors
   */
  public static readonly WISHLIST_ITEMS = [
    '.collection-item-container',
    '.collection-item-gallery',
    '.collection-item',
    '.collection-items .item',
    '.collection-items > li',
    '[data-item-id]',
    '.collection-title-details',
  ];

  /**
   * Wishlist item fallback selectors
   */
  public static readonly WISHLIST_ITEMS_FALLBACK = [
    '.collection-grid-item',
    '.música_grid li',
    '.music-grid li',
    '.collection-item-container',
    '.music_grid li',
  ];

  /**
   * Play button selectors
   */
  public static readonly PLAY_BUTTONS = [
    '.play-button', 
    '.play-col .playbutton', 
    '[class*="play"]', 
    'button[title*="Play"]',
  ];

  /**
   * Heart/wishlist icon selectors
   */
  public static readonly HEART_WISHLIST_ICONS = [
    '.wishlist-icon',
    '.fav-icon', 
    '[class*="heart"]',
    '.bc-ui2.icon.wishlist',
  ];

  /**
   * Clickable element selectors
   */
  public static readonly CLICKABLE_ELEMENTS = [
    'a',
    'button', 
    '[role="button"]',
  ];

  /**
   * Album/track link selectors
   */
  public static readonly ALBUM_TRACK_LINKS = [
    'a[href*="/album/"]',
    'a[href*="/track/"]',
  ];

  /**
   * Image selectors for Bandcamp content
   */
  public static readonly BANDCAMP_IMAGES = [
    'img[src*="bcbits.com/img"]',
  ];

  /**
   * Script elements with JSON-LD data
   */
  public static readonly JSON_LD_SCRIPTS = [
    'script[type="application/ld+json"]',
  ];

  /**
   * Tab element selectors
   */
  public static readonly TABS = [
    'li[data-tab]',
    '.tabs > li',
    '.tab-sides > li',
  ];

  /**
   * Active wishlist tab selectors
   */
  public static readonly ACTIVE_WISHLIST_TAB = [
    'li[data-tab="wishlist"].active',
    '.wishlist.active',
    'a[href*="wishlist"].active',
  ];

  /**
   * Remove button selectors
   */
  public static readonly REMOVE_BUTTONS = [
    '[title*="Remove"]',
  ];

  /**
   * Wishlist elements for toggle functionality
   */
  public static readonly WISHLIST_TOGGLE_ELEMENTS = [
    'a',
    'span', 
    '.wishlisted-msg',
    '[class*="wishlist"]',
  ];

  /**
   * Buy button selectors
   */
  public static readonly BUY_BUTTONS = [
    'button.buyItem',
    '.buy-button',
    '.buyItem',
    '[data-tralbumdata] button',
    '.commerce-button',
    'button[class*="buy"]',
    '.buyItemOrMerch',
    '.buynowlater',
    '.purchase-item',
  ];

  /**
   * Buy link selectors
   */
  public static readonly BUY_LINKS = [
    'a.buyLink',
    'a.buy-link', 
    'a[href*="buy"]',
    '.buyItem a',
    '.buy-now a',
    'a[href*="/track/"]',
    'a.buyLink',
    'a[href*="/buy"]',
    'a[href*="?buy"]',
  ];

  /**
   * Find elements using a list of selectors, returning the first successful match
   */
  public static findWithSelectors<T extends Element>(
    selectors: string[], 
    context: Document | Element = document,
  ): T[] {
    for (const selector of selectors) {
      const elements = context.querySelectorAll<T>(selector);
      if (elements && elements.length > 0) {
        return Array.from(elements);
      }
    }
    return [];
  }

  /**
   * Find a single element using a list of selectors
   */
  public static findOneWithSelectors<T extends Element>(
    selectors: string[], 
    context: Document | Element = document,
  ): T | null {
    for (const selector of selectors) {
      const element = context.querySelector<T>(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }
}
