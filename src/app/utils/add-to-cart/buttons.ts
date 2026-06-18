import {AddToCartUtils} from '../add-to-cart-utils';
import {DOMSelectors} from '../dom-selectors';
import {ErrorHandler} from '../error-handler';
import {Logger} from '../logger';

/**
 * Finding and clicking add-to-cart buttons/links.
 * Extracted from add-to-cart-utils.ts; cross-module calls route through the AddToCartUtils facade.
 */
export class AddToCartButtons {
  /**
   * Click the add to cart button on the current page
   *
   * @returns True if an add to cart button/link was found and clicked, false otherwise
   */
  public static clickAddToCartButtonOnCurrentPage(): boolean {
    try {
      // Track vs album comes straight from TralbumData (the old body-text
      // 'album'/'track' scan false-matched on tracklists, descriptions, etc.).
      const isTrack = window.TralbumData?.item_type !== 'album';

      // First, try to find add to cart buttons by text content (most reliable for modern Bandcamp)
      const addToCartButtonByText = this.findAddToCartButtonByText();
      if (addToCartButtonByText) {
        Logger.debug('Found add to cart button by text content, clicking it');
        addToCartButtonByText.click();
        // Auto-fill price after dialog opens
        AddToCartUtils.autoFillAddToCartPrice(isTrack);
        return true;
      }

      // Try to find the add to cart button using class selectors
      const addToCartButton = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_BUTTONS);
      
      if (addToCartButton) {
        Logger.debug('Found add to cart button by class selector, clicking it');
        addToCartButton.click();
        // Auto-fill price after dialog opens
        AddToCartUtils.autoFillAddToCartPrice(isTrack);
        return true;
      }

      // Try alternate selectors for add to cart links
      const addToCartLink = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_LINKS);
      
      if (addToCartLink) {
        Logger.debug('Found add to cart link, clicking it');
        addToCartLink.click();
        // Auto-fill price after dialog opens
        AddToCartUtils.autoFillAddToCartPrice(isTrack);
        return true;
      }

      Logger.warn('No add to cart button found on the current page');
      return false;
    } catch (error) {
      Logger.error('Error in clickAddToCartButtonOnCurrentPage:', error);
      ErrorHandler.withErrorHandling(() => {
        throw error; 
      }, 'Error clicking add to cart button');
      return false;
    }
  }


  /**
   * Find add to cart button by text content - most reliable for modern Bandcamp pages
   *
   * @returns The add to cart button element or null if not found
   */
  private static findAddToCartButtonByText(): HTMLElement | null {
    // Prefer the verified digital buy button in the purchase section
    // (.buyItem.digital > h4.compound-button.main-button > button.buy-link =
    // "Buy Digital Track/Album"), which opens the buy dialog. Language- and
    // copy-independent, unlike the text scan below.
    const digitalBuy = document.querySelector(
      '.buyItem.digital .compound-button.main-button .buy-link',
    ) as HTMLElement | null;
    if (digitalBuy && digitalBuy.offsetParent !== null) {
      Logger.debug('Found digital buy button via .buyItem.digital main-button');
      return digitalBuy;
    }

    // Fallback: look for buttons and links with add-to-cart related text,
    // excluding the extension's own injected controls.
    const allElements = Array.from(document.querySelectorAll('button, a, span[role="button"], div[role="button"], span.buyItem, .buyItem'))
      .filter((el) => !`${el.className || ''}`.includes('bcks'));
    
    // Physical formats to avoid (prioritize digital over physical)
    const physicalFormats = [
      'vinyl', 'cassette', 'cd', 'record', 'tape', 'physical', 'lp', 'ep',
    ];
    
    // First pass: Look specifically for digital options
    const digitalTexts = [
      'Buy Digital Track',
      'Buy Digital Album',
      'digital track',
      'digital album',
    ];
    
    for (const element of allElements) {
      const text = element.textContent?.trim() || '';
      const textLower = text.toLowerCase();
      
      // Skip if this is clearly a physical format
      if (physicalFormats.some((format) => textLower.includes(format))) {
        continue;
      }
      
      // Check for digital-specific text patterns
      for (const digitalText of digitalTexts) {
        const isExactMatch = text === digitalText;
        const isContainsMatch = textLower.includes(digitalText.toLowerCase());
        
        if (isExactMatch || (isContainsMatch && text.length < 50)) {
          const htmlElement = element as HTMLElement;
          const isDisabled = (htmlElement as any).disabled === true;
          const isVisible = htmlElement.offsetParent !== null;
          const hasHiddenStyle = window.getComputedStyle(htmlElement).display === 'none' || 
                                 window.getComputedStyle(htmlElement).visibility === 'hidden';
          
          if (isVisible && !isDisabled && !hasHiddenStyle) {
            Logger.debug(`Found digital add to cart button by text: "${text}"`);
            return htmlElement;
          }
        }
      }
    }
    
    // Second pass: Look for generic buy buttons but still avoid physical formats
    const genericBuyTexts = [
      'Buy Track',
      'Buy Album',
      'Buy Now',
      'Purchase',
      'Add to Cart',
      'Buy',
    ];
    
    for (const element of allElements) {
      const text = element.textContent?.trim() || '';
      const textLower = text.toLowerCase();
      
      // Skip if this is clearly a physical format
      if (physicalFormats.some((format) => textLower.includes(format))) {
        continue;
      }
      
      // Check if the text matches any of our generic buy patterns
      for (const buyText of genericBuyTexts) {
        const isExactMatch = text === buyText;
        const isContainsMatch = textLower.includes(buyText.toLowerCase());
        
        if (isExactMatch || (isContainsMatch && text.length < 50)) { // Avoid matching long paragraphs
          // Make sure it's clickable and visible
          const htmlElement = element as HTMLElement;
          const isDisabled = (htmlElement as any).disabled === true;
          const isVisible = htmlElement.offsetParent !== null;
          const hasHiddenStyle = window.getComputedStyle(htmlElement).display === 'none' || 
                                 window.getComputedStyle(htmlElement).visibility === 'hidden';
          
          if (isVisible && !isDisabled && !hasHiddenStyle) {
            Logger.debug(`Found generic add to cart button by text: "${text}"`);
            return htmlElement;
          }
        }
      }
    }

    // Secondary approach: look for elements that might be add to cart buttons based on structure
    const potentialAddToCartElements = Array.from(document.querySelectorAll(
      '.buyItem, .buy-button, .purchase-button, [class*="buy"], [class*="purchase"], .commerce-button',
    ));
    
    for (const element of potentialAddToCartElements) {
      const htmlElement = element as HTMLElement;
      const text = htmlElement.textContent?.trim() || '';
      const isDisabled = (htmlElement as any).disabled === true;
      const isVisible = htmlElement.offsetParent !== null;
      
      // Check if it has add to cart related text or seems to be an add to cart button
      if (isVisible && !isDisabled && (
        text.toLowerCase().includes('buy') ||
        text.toLowerCase().includes('purchase') ||
        text.toLowerCase().includes('digital') ||
        text.toLowerCase().includes('track') ||
        text.toLowerCase().includes('album')
      )) {
        Logger.debug(`Found potential add to cart button by class with text: "${text}"`);
        return htmlElement;
      }
    }

    return null;
  }


  /**
   * Find add to cart link in a specific element/container
   *
   * @param container The container element to search within
   * @returns The add to cart link element or null if not found
   */
  public static findAddToCartLinkInContainer(container: HTMLElement): HTMLElement | null {
    // First try standard add to cart link selectors
    let addToCartLink = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_LINKS, container);
    
    if (addToCartLink) {
      return addToCartLink;
    }

    // Look for elements with the text "buy now"
    const allSpans = container.querySelectorAll('span.txt');
    for (let i = 0; i < allSpans.length; i++) {
      const span = allSpans[i];
      if (span.textContent && span.textContent.trim().toLowerCase() === 'buy now') {
        addToCartLink = span.closest('a') as HTMLElement;
        if (addToCartLink) {
          return addToCartLink;
        }
      }
    }

    return null;
  }


  // Labels that would advance toward or complete a purchase. The extension must
  // add to cart only, so a button matching any of these is never clicked. The
  // dialog's add control is "Add to cart" (none of these), so this only ever
  // blocks a mis-click; widen freely.
  private static readonly PURCHASE_LABELS = /\b(buy now|pay|purchase|checkout|check out|order|continue|proceed|submit|get it now|place (your )?order|complete|confirm)\b/i;

  /**
   * Automatically click the buy dialog's "Add to cart" button.
   *
   * Targets Bandcamp's canonical, dialog-scoped add-to-cart control rather than
   * guessing by color/class, and refuses any control whose label would advance
   * toward checkout/payment.
   */
  public static clickAddToCartButton(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldCloseTab = urlParams.get('close_tab_after_add') === 'true';

    try {
      const addToCartButton = this.findDialogAddToCartButton();

      if (addToCartButton) {
        Logger.debug('Clicking "Add to cart" button');
        addToCartButton.click();

        if (shouldCloseTab) {
          Logger.debug('Closing tab after add to cart button click');
          setTimeout(() => window.close(), 100);
        }
      } else {
        Logger.warn('Could not find "Add to cart" button to click automatically');
        if (shouldCloseTab) {
          Logger.debug('Closing tab - could not find add to cart button');
          setTimeout(() => window.close(), 1000);
        }
      }
    } catch (error) {
      Logger.error('Error clicking "Add to cart" button:', error);
      if (shouldCloseTab) {
        Logger.debug('Closing tab after error');
        setTimeout(() => window.close(), 1000);
      }
    }
  }


  /**
   * Find the buy dialog's "Add to cart" button using precise, verified selectors.
   * Never returns a checkout/pay/purchase control (see PURCHASE_LABELS) or the
   * extension's own injected buttons.
   *
   * @returns The add-to-cart button, or null if none is present/visible
   */
  private static findDialogAddToCartButton(): HTMLElement | null {
    const isOwn = (el: Element): boolean => `${el.className ?? ''}`.includes('bcks');
    const isVisible = (el: HTMLElement): boolean => el.offsetParent !== null;
    const safeLabel = (el: Element): boolean => !this.PURCHASE_LABELS.test(this.labelOf(el));

    // 1. Canonical buy-dialog add-to-cart button (verified against live DOM).
    const wrapperBtn = document.querySelector('.cart-button-wrapper button') as HTMLElement | null;
    if (wrapperBtn && isVisible(wrapperBtn) && safeLabel(wrapperBtn)) {
      Logger.debug('Found add-to-cart button via .cart-button-wrapper');
      return wrapperBtn;
    }

    // 2. Scoped text fallback for markup drift: a visible button whose label is
    //    explicitly "add to cart" (and is not a checkout control or our own UI).
    const candidates = Array.from(
      document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"]'),
    );
    for (const el of candidates) {
      if (isOwn(el) || !isVisible(el as HTMLElement) || !safeLabel(el)) {
        continue;
      }
      if (this.labelOf(el).toLowerCase().includes('add to cart')) {
        Logger.debug('Found add-to-cart button by text fallback');
        return el as HTMLElement;
      }
    }

    return null;
  }


  /** The clickable's visible label (button text, falling back to input value). */
  private static labelOf(el: Element): string {
    const text = (el.textContent ?? '').trim();
    return text || (el as HTMLInputElement).value || '';
  }
}
