import {AddToCartUrl} from './add-to-cart/url';
import {AddToCartButtons} from './add-to-cart/buttons';
import {AddToCartPrice} from './add-to-cart/price';
import {AddToCartItems} from './add-to-cart/items';

/**
 * Add-to-cart utilities. Thin facade delegating to the focused modules in ./add-to-cart/.
 */
export class AddToCartUtils {
  public static clickAddToCartButtonOnCurrentPage(): boolean {
    return AddToCartButtons.clickAddToCartButtonOnCurrentPage();
  }

  public static findAddToCartLinkInContainer(container: HTMLElement): HTMLElement | null {
    return AddToCartButtons.findAddToCartLinkInContainer(container);
  }

  public static clickAddToCartButton(): void {
    AddToCartButtons.clickAddToCartButton();
  }

  public static addWishlistParameterToUrl(url: string): string {
    return AddToCartUrl.addWishlistParameterToUrl(url);
  }

  public static openWishlistLinkWithWishlist(href: string): void {
    AddToCartUrl.openWishlistLinkWithWishlist(href);
  }

  public static addCartParameterToUrl(url: string, closeTabAfterAdd = false): string {
    return AddToCartUrl.addCartParameterToUrl(url, closeTabAfterAdd);
  }

  public static openAddToCartLinkWithCart(href: string, closeTabAfterAdd = false): void {
    AddToCartUrl.openAddToCartLinkWithCart(href, closeTabAfterAdd);
  }

  public static autoFillAddToCartPrice(isTrack = true): void {
    AddToCartPrice.autoFillAddToCartPrice(isTrack);
  }

  public static async addWishlistItemToCart(
    item: HTMLElement,
    options: {
      checkNowPlaying?: boolean;
      logPrefix?: string;
      closeTabAfterAdd?: boolean;
    } = {}
  ): Promise<void> {
    return AddToCartItems.addWishlistItemToCart(item, options);
  }
}
