import { DOMSelectors } from './dom-selectors';
import { ErrorHandler } from './error-handler';
import { Logger } from './logger';

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
      let clicked = false;
      let isTrack = true; // Default to track, will try to detect

      // Try to detect if this is a track or album page
      const pageText = document.body.textContent?.toLowerCase() || '';
      if (pageText.includes('album') && !pageText.includes('track')) {
        isTrack = false;
      }

      // First, try to find buy buttons by text content (most reliable for modern Bandcamp)
      const buyButtonByText = this.findBuyButtonByText();
      if (buyButtonByText) {
        Logger.info('Found buy button by text content, clicking it');
        buyButtonByText.click();
        clicked = true;

        // Auto-fill price after dialog opens
        this.autoFillBuyPrice(isTrack);
        return true;
      }

      // Try to find the buy button using class selectors
      const buyButton = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_BUTTONS);
      
      if (buyButton) {
        Logger.info('Found buy button by class selector, clicking it');
        buyButton.click();
        clicked = true;

        // Auto-fill price after dialog opens
        this.autoFillBuyPrice(isTrack);
        return true;
      }

      // Try alternate selectors for buy links
      const buyLink = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.BUY_LINKS);
      
      if (buyLink) {
        Logger.info('Found buy link, clicking it');
        buyLink.click();
        clicked = true;

        // Auto-fill price after dialog opens
        this.autoFillBuyPrice(isTrack);
        return true;
      }

      Logger.warn('No buy button found on the current page');
      return false;
    } catch (error) {
      ErrorHandler.withErrorHandling(() => { throw error; }, 'Error clicking buy button');
      return false;
    }
  }

  /**
   * Find buy button by text content - most reliable for modern Bandcamp pages
   * @returns The buy button element or null if not found
   */
  private static findBuyButtonByText(): HTMLElement | null {
    // Common buy button text patterns on Bandcamp (prioritized by specificity)
    const buyTexts = [
      'Buy Digital Track',
      'Buy Digital Album', 
      'Buy Track',
      'Buy Album',
      'Buy Now',
      'Purchase',
      'Add to Cart',
      'Buy',
      'digital track',
      'digital album'
    ];

    // Look for buttons and links with buy-related text
    const allElements = Array.from(document.querySelectorAll('button, a, span[role="button"], div[role="button"], span.buyItem, .buyItem'));
    
    for (const element of allElements) {
      const text = element.textContent?.trim() || '';
      
      // Check if the text matches any of our buy patterns
      for (const buyText of buyTexts) {
        const isExactMatch = text === buyText;
        const isContainsMatch = text.toLowerCase().includes(buyText.toLowerCase());
        
        if (isExactMatch || (isContainsMatch && text.length < 50)) { // Avoid matching long paragraphs
          // Make sure it's clickable and visible
          const htmlElement = element as HTMLElement;
          const isDisabled = (htmlElement as any).disabled === true;
          const isVisible = htmlElement.offsetParent !== null;
          const hasHiddenStyle = window.getComputedStyle(htmlElement).display === 'none' || 
                                 window.getComputedStyle(htmlElement).visibility === 'hidden';
          
          if (isVisible && !isDisabled && !hasHiddenStyle) {
            Logger.info(`Found buy button with text: "${text}" (matched pattern: "${buyText}")`);
            return htmlElement;
          }
        }
      }
    }

    // Secondary approach: look for elements that might be buy buttons based on structure
    const potentialBuyElements = Array.from(document.querySelectorAll(
      '.buyItem, .buy-button, .purchase-button, [class*="buy"], [class*="purchase"], .commerce-button'
    ));
    
    for (const element of potentialBuyElements) {
      const htmlElement = element as HTMLElement;
      const text = htmlElement.textContent?.trim() || '';
      const isDisabled = (htmlElement as any).disabled === true;
      const isVisible = htmlElement.offsetParent !== null;
      
      // Check if it has buy-related text or seems to be a buy button
      if (isVisible && !isDisabled && (
        text.toLowerCase().includes('buy') ||
        text.toLowerCase().includes('purchase') ||
        text.toLowerCase().includes('digital') ||
        text.toLowerCase().includes('track') ||
        text.toLowerCase().includes('album')
      )) {
        Logger.info(`Found potential buy button by class with text: "${text}"`);
        return htmlElement;
      }
    }

    return null;
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
    Logger.info('Opening buy link with add_to_cart parameter in new tab:', cartUrl);
    window.open(cartUrl, '_blank');
  }

  /**
   * Automatically fill in the minimum price in the buy dialog
   * @param isTrack Whether this is for a track (true) or album (false)
   */
  public static autoFillBuyPrice(isTrack: boolean = true): void {
    // Wait a bit for the dialog to fully render
    setTimeout(() => {
      try {
        // Look for the price input field with multiple possible selectors
        const priceInputSelectors = [
          'input[type="text"][placeholder*="amount"]',
          'input[type="number"]',
          'input[name*="amount"]',
          'input[name*="price"]',
          'input[placeholder*="amount"]',
          'input[placeholder*="price"]',
          '.price-input input',
          '.amount-input input',
          '.payment-amount input',
          'input[type="text"]' // Fallback - any text input
        ];
        
        let priceInput: HTMLInputElement | null = null;
        
        // Try each selector until we find a suitable input
        for (const selector of priceInputSelectors) {
          const inputNodeList = document.querySelectorAll(selector) as NodeListOf<HTMLInputElement>;
          const inputs = Array.from(inputNodeList);
          for (const input of inputs) {
            // Check if this input looks like it's for price entry
            const placeholder = input.placeholder?.toLowerCase() || '';
            const name = input.name?.toLowerCase() || '';
            const id = input.id?.toLowerCase() || '';
            const className = input.className?.toLowerCase() || '';
            
            if (placeholder.includes('amount') || placeholder.includes('price') ||
                name.includes('amount') || name.includes('price') ||
                id.includes('amount') || id.includes('price') ||
                className.includes('amount') || className.includes('price')) {
              priceInput = input;
              break;
            }
          }
          if (priceInput) break;
        }
        
        // If we still haven't found one, try any visible text input in the dialog
        if (!priceInput) {
          const allTextInputNodeList = document.querySelectorAll('input[type="text"], input:not([type])') as NodeListOf<HTMLInputElement>;
          const allTextInputs = Array.from(allTextInputNodeList);
          for (const input of allTextInputs) {
            // Check if it's visible and potentially a price input
            const rect = input.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && !input.disabled && !input.readOnly) {
              // If there's only one visible text input, assume it's the price input
              if (allTextInputs.length === 1) {
                priceInput = input;
                break;
              }
              // If there are multiple, look for contextual clues
              const parentElement = input.closest('form, div, section');
              if (parentElement) {
                const parentText = parentElement.textContent?.toLowerCase() || '';
                if (parentText.includes('amount') || parentText.includes('price') || 
                    parentText.includes('pay') || parentText.includes('minimum')) {
                  priceInput = input;
                  break;
                }
              }
            }
          }
        }
        
        if (priceInput) {
          // Try to find the minimum price from the dialog
          let minPrice = BuyUtils.extractMinimumPrice();
          
          if (!minPrice) {
            // Fallback: use reasonable defaults based on currency and item type
            minPrice = BuyUtils.getDefaultPrice(isTrack);
          }
          
          Logger.info(`Auto-filling buy price: ${minPrice}`);
          
          // Clear the current value and fill in the price
          priceInput.value = '';
          priceInput.value = minPrice;
          
          // Trigger events to ensure the change is registered
          priceInput.dispatchEvent(new Event('input', { bubbles: true }));
          priceInput.dispatchEvent(new Event('change', { bubbles: true }));
          priceInput.dispatchEvent(new Event('keyup', { bubbles: true }));
          
          // Focus the input to make it clear it's been filled
          priceInput.focus();
          
          // Also try triggering a blur event after a short delay to ensure validation
          setTimeout(() => {
            priceInput?.blur();
            priceInput?.focus();
          }, 100);
          
          // Auto-click "Add to cart" button after filling price
          setTimeout(() => {
            BuyUtils.clickAddToCartButton();
          }, 300);
          
        } else {
          Logger.warn('Could not find price input field in buy dialog');
        }
      } catch (error) {
        ErrorHandler.withErrorHandling(() => { throw error; }, 'Error auto-filling buy price');
      }
    }, 500); // Give the dialog time to render
  }

  /**
   * Extract the minimum price from the buy dialog
   * @returns The minimum price as a string, or null if not found
   */
  private static extractMinimumPrice(): string | null {
    try {
      // Look for text patterns that indicate minimum price
      const pricePatterns = [
        /\$([0-9]+\.?[0-9]*)\s+or\s+more/i,  // "$1.50 or more"
        /€([0-9]+\.?[0-9]*)\s+or\s+more/i,   // "€1.50 or more"
        /£([0-9]+\.?[0-9]*)\s+or\s+more/i,   // "£1.50 or more"
        /([0-9]+\.?[0-9]*)\s+USD\s+or\s+more/i, // "1.50 USD or more"
        /([0-9]+\.?[0-9]*)\s+EUR\s+or\s+more/i, // "1.50 EUR or more"
        /minimum.*?\$([0-9]+\.?[0-9]*)/i,    // "minimum $1.50"
        /minimum.*?€([0-9]+\.?[0-9]*)/i,     // "minimum €1.50"
        /minimum.*?£([0-9]+\.?[0-9]*)/i      // "minimum £1.50"
      ];

      // Search through all text on the page
      const allText = document.body.textContent || '';
      
      for (const pattern of pricePatterns) {
        const match = allText.match(pattern);
        if (match && match[1]) {
          const price = parseFloat(match[1]);
          if (price > 0) {
            // Return the price with appropriate currency symbol
            if (pattern.source.includes('€') || allText.includes('EUR')) {
              return price.toFixed(2);
            } else if (pattern.source.includes('£')) {
              return price.toFixed(2);
            } else {
              return price.toFixed(2);
            }
          }
        }
      }

      // Also check for minimum price in specific dialog elements
      const priceElements = Array.from(document.querySelectorAll('.price, .minimum, .amount, [class*="price"], [class*="minimum"]'));
      for (const element of priceElements) {
        const text = element.textContent || '';
        for (const pattern of pricePatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const price = parseFloat(match[1]);
            if (price > 0) {
              return price.toFixed(2);
            }
          }
        }
      }

      return null;
    } catch (error) {
      Logger.error('Error extracting minimum price:', error);
      return null;
    }
  }

  /**
   * Get default price based on currency and item type
   * @param isTrack Whether this is for a track (true) or album (false)
   * @returns Default price as string
   */
  private static getDefaultPrice(isTrack: boolean): string {
    try {
      // Detect currency from page content or browser locale
      const pageText = document.body.textContent || '';
      
      if (pageText.includes('€') || pageText.includes('EUR')) {
        // Euro pricing
        return isTrack ? '1.00' : '5.00';
      } else if (pageText.includes('£') || pageText.includes('GBP')) {
        // British Pound pricing
        return isTrack ? '0.80' : '4.00';
      } else if (pageText.includes('¥') || pageText.includes('JPY')) {
        // Japanese Yen pricing
        return isTrack ? '100' : '500';
      } else if (pageText.includes('CAD')) {
        // Canadian Dollar pricing
        return isTrack ? '1.25' : '6.25';
      } else {
        // Default to USD pricing
        return isTrack ? '1.00' : '5.00';
      }
    } catch (error) {
      Logger.error('Error determining default price:', error);
      // Fallback to USD
      return isTrack ? '1.00' : '5.00';
    }
  }

  /**
   * Automatically click the "Add to cart" button in the buy dialog
   */
  public static clickAddToCartButton(): void {
    try {
      // Look for the "Add to cart" button with multiple possible selectors
      const addToCartSelectors = [
        'button:contains("Add to cart")',
        'button[title*="Add to cart"]',
        '.add-to-cart-button',
        '.cart-button',
        'button[class*="cart"]',
        'input[value*="Add to cart"]',
        'button[value*="Add to cart"]',
        // Based on the screenshot, look for blue button with cart icon
        '.buynow-btn', // Common Bandcamp buy button class
        'button:has(.icon-cart)', // Button with cart icon
        'button:has(svg)', // Button with SVG (likely cart icon)
        'button[style*="background-color: rgb(27, 129, 229)"]', // Blue color from screenshot
        'button[style*="background-color: #1b81e5"]' // Blue color hex
      ];
      
      let addToCartButton: HTMLElement | null = null;
      
      // First try to find button by text content (most reliable)
      const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]'));
      for (const button of allButtons) {
        const text = button.textContent?.trim().toLowerCase() || '';
        const value = (button as HTMLInputElement).value?.toLowerCase() || '';
        
        if (text.includes('add to cart') || value.includes('add to cart') || 
            text.includes('🛒') || text.includes('cart')) {
          addToCartButton = button as HTMLElement;
          Logger.info('Found "Add to cart" button by text:', text || value);
          break;
        }
      }
      
      // If not found by text, try the selectors
      if (!addToCartButton) {
        for (const selector of addToCartSelectors) {
          // Skip jQuery-style selectors for now
          if (selector.includes(':contains') || selector.includes(':has')) {
            continue;
          }
          
          const button = document.querySelector(selector) as HTMLElement;
          if (button && button.offsetParent !== null) { // Check if visible
            addToCartButton = button;
            Logger.info('Found "Add to cart" button by selector:', selector);
            break;
          }
        }
      }
      
      // Last resort: look for any blue button in the dialog (common Bandcamp pattern)
      if (!addToCartButton) {
        const blueButtons = Array.from(document.querySelectorAll('button')) as HTMLElement[];
        for (const button of blueButtons) {
          const styles = window.getComputedStyle(button);
          const bgColor = styles.backgroundColor;
          
          // Check for blue-ish background colors (Bandcamp's "Add to cart" is typically blue)
          if (bgColor.includes('rgb(27, 129, 229)') || bgColor.includes('rgb(29, 161, 242)') || 
              bgColor.includes('#1b81e5') || bgColor.includes('#1da1f2') ||
              bgColor.includes('blue') || button.className.includes('primary')) {
            addToCartButton = button;
            Logger.info('Found potential "Add to cart" button by blue color');
            break;
          }
        }
      }
      
      if (addToCartButton) {
        Logger.info('Clicking "Add to cart" button automatically');
        addToCartButton.click();
      } else {
        Logger.warn('Could not find "Add to cart" button to click automatically');
      }
      
    } catch (error) {
      Logger.error('Error clicking "Add to cart" button:', error);
    }
  }
}
