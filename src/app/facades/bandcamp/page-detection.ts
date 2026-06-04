/**
 * Bandcamp page-type detection.
 *
 * Extracted from BandcampFacade so page-type logic lives in one focused place.
 * Results are cached per page and cleared on SPA navigation via reset().
 * BandcampFacade exposes these as `is*` getters that delegate here, so callers
 * continue to use `BandcampFacade.isAlbum` etc.
 */
export class PageDetection {
  private static _isTrack?: boolean;
  private static _isAlbum?: boolean;
  private static _isWishlistPage?: boolean;
  private static _isCollectionPage?: boolean;
  private static _isFollowersPage?: boolean;
  private static _isFollowingPage?: boolean;

  public static get isTrack(): boolean {
    if (typeof this._isTrack !== 'undefined') {
      return this._isTrack;
    }

    this._isTrack = window.location.href.includes('/track/');

    return this._isTrack;
  }

  public static get isAlbum(): boolean {
    if (typeof this._isAlbum !== 'undefined') {
      return this._isAlbum;
    }

    this._isAlbum = !this.isTrack && document.getElementById('trackInfo') !== null;

    return this._isAlbum;
  }

  public static get isWishlistPage(): boolean {
    if (typeof this._isWishlistPage !== 'undefined') {
      return this._isWishlistPage;
    }

    // Only activate wishlist controls when URL matches the specific format: bandcamp.com/username/wishlist
    // This excludes collection pages (bandcamp.com/username) and other pages
    const url = window.location.href;
    const wishlistRegex = /^https?:\/\/[^\/]*bandcamp\.com\/[^\/]+\/wishlist(?:[?#].*)?$/;
    this._isWishlistPage = wishlistRegex.test(url);

    return this._isWishlistPage;
  }

  public static get isCollectionPage(): boolean {
    if (typeof this._isCollectionPage !== 'undefined') {
      return this._isCollectionPage;
    }

    // Detect collection pages: bandcamp.com/username (without /wishlist, /followers, or /following)
    const url = window.location.href;
    const collectionRegex = /^https?:\/\/[^\/]*bandcamp\.com\/[^\/]+(?:[?#].*)?$/;
    this._isCollectionPage = collectionRegex.test(url) && !this.isWishlistPage && !this.isFollowersPage && !this.isFollowingPage;

    return this._isCollectionPage;
  }

  public static get isFollowersPage(): boolean {
    if (typeof this._isFollowersPage !== 'undefined') {
      return this._isFollowersPage;
    }

    const url = window.location.href;
    const followersRegex = /^https?:\/\/[^\/]*bandcamp\.com\/[^\/]+\/followers(?:\/.*)?(?:[?#].*)?$/;
    this._isFollowersPage = followersRegex.test(url);

    return this._isFollowersPage;
  }

  public static get isFollowingPage(): boolean {
    if (typeof this._isFollowingPage !== 'undefined') {
      return this._isFollowingPage;
    }

    const url = window.location.href;
    const followingRegex = /^https?:\/\/[^\/]*bandcamp\.com\/[^\/]+\/following(?:\/.*)?(?:[?#].*)?$/;
    this._isFollowingPage = followingRegex.test(url);

    return this._isFollowingPage;
  }

  /**
   * Check if current page supports track transport controls (wishlist or collection)
   */
  public static get isCollectionBasedPage(): boolean {
    return this.isWishlistPage || this.isCollectionPage;
  }

  /**
   * Whether the current page is an individual release (album or track) page.
   */
  public static get isPageSupported(): boolean {
    return this.isAlbum || this.isTrack;
  }

  /**
   * Whether a Bandcamp fan is logged in, derived from the #pagedata blob.
   */
  public static get isLoggedIn(): boolean {
    const dataBlob = document.getElementById('pagedata')?.getAttribute('data-blob');
    return !!dataBlob && !dataBlob.includes('"fan_tralbum_data":null');
  }

  /**
   * Clear cached page-type flags (call on SPA navigation).
   */
  public static reset(): void {
    this._isTrack = undefined;
    this._isAlbum = undefined;
    this._isWishlistPage = undefined;
    this._isCollectionPage = undefined;
    this._isFollowersPage = undefined;
    this._isFollowingPage = undefined;
  }
}
