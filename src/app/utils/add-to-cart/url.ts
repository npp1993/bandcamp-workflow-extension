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
    if (url.includes('?')) {
      return url + '&wishlist=true';
    } else {
      return url + '?wishlist=true';
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
    const params = ['add_to_cart=true'];
    if (closeTabAfterAdd) {
      params.push('close_tab_after_add=true');
    }
    
    const paramString = params.join('&');
    
    if (url.includes('?')) {
      return url + '&' + paramString;
    } else {
      return url + '?' + paramString;
    }
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
