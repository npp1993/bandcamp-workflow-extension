import {Logger} from '../logger';

/**
 * Add-to-cart URL parameter helpers.
 * Extracted from add-to-cart-utils.ts; cross-module calls route through the AddToCartUtils facade.
 */
export class AddToCartUrl {

  /**
   * Add wishlist parameter to a URL
   *
   * @param url The URL to modify
   * @returns The URL with wishlist=true parameter
   */
  public static addWishlistParameterToUrl(url: string): string {
    return this.addParams(url, {wishlist: 'true'});
  }


  /**
   * Add query parameters to a URL, correctly placing them before any #fragment
   * (a naive `?`/`&` append puts them inside the fragment, where
   * `location.search` never sees them).
   *
   * @param url The URL to modify
   * @param params Key/value parameters to set
   * @returns The URL with the parameters applied
   */
  private static addParams(url: string, params: Record<string, string>): string {
    try {
      const u = new URL(url, window.location.href);
      for (const [key, value] of Object.entries(params)) {
        u.searchParams.set(key, value);
      }
      return u.toString();
    } catch {
      // Fallback for non-parseable strings: insert before any fragment.
      const [base, ...fragParts] = url.split('#');
      const sep = base.includes('?') ? '&' : '?';
      const query = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
      const fragment = fragParts.length > 0 ? `#${fragParts.join('#')}` : '';
      return `${base}${sep}${query}${fragment}`;
    }
  }


  /**
   * Open wishlist link with wishlist parameter in new tab
   *
   * @param href The URL to open
   */
  public static openWishlistLinkWithWishlist(href: string): void {
    const wishlistUrl = this.addWishlistParameterToUrl(href);
    Logger.debug('Opening wishlist link with wishlist parameter in new tab:', wishlistUrl);
    window.open(wishlistUrl, '_blank');
  }


  /**
   * Add add_to_cart parameter to a URL
   *
   * @param url The URL to modify
   * @param closeTabAfterAdd Whether to add close_tab_after_add=true parameter
   * @returns The URL with add_to_cart=true parameter (and optionally close_tab_after_add=true)
   */
  public static addCartParameterToUrl(url: string, closeTabAfterAdd = false): string {
    const params: Record<string, string> = {add_to_cart: 'true'};
    if (closeTabAfterAdd) {
      params.close_tab_after_add = 'true';
    }
    return this.addParams(url, params);
  }


  /**
   * Open add to cart link with add_to_cart parameter in new tab
   *
   * @param href The URL to open
   * @param closeTabAfterAdd Whether to close the tab after adding to cart
   */
  public static openAddToCartLinkWithCart(href: string, closeTabAfterAdd = false): void {
    const cartUrl = this.addCartParameterToUrl(href, closeTabAfterAdd);
    Logger.debug('Opening add to cart link with add_to_cart parameter in new tab:', cartUrl);
    window.open(cartUrl, '_blank');
  }
}
