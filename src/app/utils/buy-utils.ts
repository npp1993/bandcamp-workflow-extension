import { DOMSelectors } from './dom-selectors';
import { ErrorHandler } from './error-handler';

/**
 * Utility for buy button functionality
 */
export class BuyUtils {
  /**
   * Click the buy button on the current page
   * @returns True if a buy button/link was found and clicked, false otherwise
   */
  public static clickBuyButtonOnCurrentPage(): boolean {
    try {
      // Try to find the buy button on the page
      const buyButton = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_BUTTONS);
      
      if (buyButton) {
        console.log('Found buy button, clicking it');
        buyButton.click();
        return true;
      }

      // Try alternate selectors for buy links
      const buyLink = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_LINKS);
      
      if (buyLink) {
        console.log('Found buy link, clicking it');
        buyLink.click();
        return true;
      }

      console.warn('No buy button found on the current page');
      return false;
    } catch (error) {
      ErrorHandler.withErrorHandling(() => { throw error; }, 'Error clicking buy button');
      return false;
    }
  }

  /**
   * Find buy link in a specific element/container
   * @param container The container element to search within
   * @returns The buy link element or null if not found
   */
  public static findBuyLinkInContainer(container: HTMLElement): HTMLElement | null {
    // First try standard buy link selectors
    let buyLink = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_LINKS, container);
    
    if (buyLink) {
      return buyLink;
    }

    // Look for elements with the text "buy now"
    const allSpans = container.querySelectorAll('span.txt');
    for (let i = 0; i < allSpans.length; i++) {
      const span = allSpans[i];
      if (span.textContent && span.textContent.trim().toLowerCase() === 'buy now') {
        buyLink = span.closest('a') as HTMLElement;
        if (buyLink) {
          return buyLink;
        }
      }
    }

    return null;
  }

  /**
   * Add add_to_cart parameter to a URL
   * @param url The URL to modify
   * @returns The URL with add_to_cart=true parameter
   */
  public static addCartParameterToUrl(url: string): string {
    if (url.includes('?')) {
      return url + '&add_to_cart=true';
    } else {
      return url + '?add_to_cart=true';
    }
  }

  /**
   * Open buy link with add_to_cart parameter in new tab
   * @param href The URL to open
   */
  public static openBuyLinkWithCart(href: string): void {
    const cartUrl = this.addCartParameterToUrl(href);
    console.log('Opening buy link with add_to_cart parameter in new tab:', cartUrl);
    window.open(cartUrl, '_blank');
  }
}
