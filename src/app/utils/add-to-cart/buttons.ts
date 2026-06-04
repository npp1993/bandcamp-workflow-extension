import {DOMSelectors} from '../dom-selectors';
import {ErrorHandler} from '../error-handler';
import {Logger} from '../logger';
import {AddToCartUtils} from '../add-to-cart-utils';

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
      let clicked = false;
      let isTrack = true; // Default to track, will try to detect

      // Try to detect if this is a track or album page
      const pageText = document.body.textContent?.toLowerCase() || '';
      if (pageText.includes('album') && !pageText.includes('track')) {
        isTrack = false;
      }

      // First, try to find add to cart buttons by text content (most reliable for modern Bandcamp)
      const addToCartButtonByText = this.findAddToCartButtonByText();
      if (addToCartButtonByText) {
        Logger.debug('Found add to cart button by text content, clicking it');
        addToCartButtonByText.click();
        clicked = true;

        // Auto-fill price after dialog opens
        AddToCartUtils.autoFillAddToCartPrice(isTrack);
        return true;
      }

      // Try to find the add to cart button using class selectors
      const addToCartButton = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_BUTTONS);
      
      if (addToCartButton) {
        Logger.debug('Found add to cart button by class selector, clicking it');
        addToCartButton.click();
        clicked = true;

        // Auto-fill price after dialog opens
        AddToCartUtils.autoFillAddToCartPrice(isTrack);
        return true;
      }

      // Try alternate selectors for add to cart links
      const addToCartLink = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_LINKS);
      
      if (addToCartLink) {
        Logger.debug('Found add to cart link, clicking it');
        addToCartLink.click();
        clicked = true;

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
    // Look for buttons and links with add to cart related text
    const allElements = Array.from(document.querySelectorAll('button, a, span[role="button"], div[role="button"], span.buyItem, .buyItem'));
    
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


  /**
   * Automatically click the "Add to cart" button in the buy dialog
   */
  public static clickAddToCartButton(): void {
    try {
      // Check if we should close the tab after adding to cart
      const urlParams = new URLSearchParams(window.location.search);
      const shouldCloseTab = urlParams.get('close_tab_after_add') === 'true';

      // Look for the "Add to cart" button with multiple possible selectors
      const addToCartSelectors = [
        'button[title*="Add to cart"]',
        '.add-to-cart-button',
        '.cart-button',
        'button[class*="cart"]',
        'input[value*="Add to cart"]',
        'button[value*="Add to cart"]',
        // Based on the screenshot, look for blue button with cart icon
        '.buynow-btn', // Common Bandcamp buy button class
        'button[style*="background-color: rgb(27, 129, 229)"]', // Blue color from screenshot
        'button[style*="background-color: #1b81e5"]', // Blue color hex
      ];
      
      let addToCartButton: HTMLElement | null = null;
      
      // First try to find button by text content (most reliable)
      const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]'));
      
      for (const button of allButtons) {
        const text = button.textContent?.trim().toLowerCase() || '';
        const value = (button as HTMLInputElement).value?.toLowerCase() || '';
        const className = button.className || '';
        
        // Skip extension's own sidebar buttons to prevent infinite loop
        if (className.includes('bandcamp-workflow-hotkey') || 
            className.includes('bandcamp-workflow-setting') ||
            className.includes('bandcamp-workflow')) {
          continue;
        }
        
        if (text.includes('add to cart') || value.includes('add to cart') || 
            text.includes('🛒') || text.includes('cart')) {
          addToCartButton = button as HTMLElement;
          Logger.debug('Found "Add to cart" button by text:', text || value);
          break;
        }
      }
      
      // If not found by text, try the selectors
      if (!addToCartButton) {
        for (const selector of addToCartSelectors) {
          const buttons = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
          
          for (const button of buttons) {
            // Skip extension's own sidebar buttons
            if (button.className.includes('bandcamp-workflow')) {
              continue;
            }
            
            if (button && button.offsetParent !== null) { // Check if visible
              addToCartButton = button;
              Logger.debug('Found "Add to cart" button by selector:', selector);
              break;
            }
          }
          
          if (addToCartButton) {
            break;
          }
        }
      }
      
      // Last resort: look for any blue button in the dialog (common Bandcamp pattern)
      if (!addToCartButton) {
        const blueButtons = Array.from(document.querySelectorAll('button')) as HTMLElement[];
        
        for (const button of blueButtons) {
          // Skip extension's own sidebar buttons
          if (button.className.includes('bandcamp-workflow')) {
            continue;
          }
          
          const styles = window.getComputedStyle(button);
          const bgColor = styles.backgroundColor;
          
          // Check for blue-ish background colors (Bandcamp's "Add to cart" is typically blue)
          if (bgColor.includes('rgb(27, 129, 229)') || bgColor.includes('rgb(29, 161, 242)') || 
              bgColor.includes('#1b81e5') || bgColor.includes('#1da1f2') ||
              bgColor.includes('blue') || button.className.includes('primary')) {
            addToCartButton = button;
            Logger.debug('Found potential "Add to cart" button by blue color');
            break;
          }
        }
      }
      
      if (addToCartButton) {
        Logger.debug('Clicking "Add to cart" button');
        addToCartButton.click();
        
        // Close tab immediately after clicking if requested
        if (shouldCloseTab) {
          Logger.debug('Closing tab after add to cart button click');
          // Small delay to ensure the click is processed
          setTimeout(() => {
            window.close();
          }, 100);
        }
      } else {
        Logger.warn('Could not find "Add to cart" button to click automatically');
        // If we can't find the button but should close tab, close anyway
        if (shouldCloseTab) {
          Logger.debug('Closing tab - could not find add to cart button');
          setTimeout(() => {
            window.close();
          }, 1000); // Give more time in case something is still loading
        }
      }
    } catch (error) {
      Logger.error('Error clicking "Add to cart" button:', error);
      // If there's an error but we should close tab, still close it
      const urlParams = new URLSearchParams(window.location.search);
      const shouldCloseTab = urlParams.get('close_tab_after_add') === 'true';
      if (shouldCloseTab) {
        Logger.debug('Closing tab after error');
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    }
  }
}
