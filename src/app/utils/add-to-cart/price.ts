import {ErrorHandler} from '../error-handler';
import {Logger} from '../logger';
import {AddToCartUtils} from '../add-to-cart-utils';

/**
 * Price detection and auto-fill of the add-to-cart dialog.
 * Extracted from add-to-cart-utils.ts; cross-module calls route through the AddToCartUtils facade.
 */
export class AddToCartPrice {

  /**
   * Automatically fill in the minimum price in the add to cart dialog
   *
   * @param isTrack Whether this is for a track (true) or album (false)
   */
  public static autoFillAddToCartPrice(isTrack = true): void {
    // Wait a bit for the dialog to fully render
    setTimeout(() => {
      try {
        // First check if this is a fixed-price item (no price input needed)
        let isFixedPrice = false;
        
        // Check for explicit fixed-price indicators
        const fixedPriceSelectors = [
          '.display-price.fixed-price',
          '.fixed-price',
          '[class*="fixed-price"]'
        ];
        
        for (const selector of fixedPriceSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            isFixedPrice = true;
            Logger.debug('Detected fixed-price item');
            break;
          }
        }
        
        // Check for NYP (name-your-price) indicators - these are NOT fixed price
        if (!isFixedPrice) {
          const nypIndicators = [
            '.nyp-symbol',
            '.nyp-wrapper',
            '.nyp-summary',
            '[class*="nyp"]',
            'label[for*="userPrice"]',
            'input[id*="userPrice"]'
          ];
          
          let isNYP = false;
          for (const selector of nypIndicators) {
            const element = document.querySelector(selector);
            if (element) {
              isNYP = true;
              Logger.debug('Detected name-your-price (NYP) item');
              break;
            }
          }
          
          // Also check for text indicators of NYP
          if (!isNYP) {
            const pageText = document.body.textContent || '';
            const nypTextPatterns = [
              'or more',
              'minimum',
              'Enter amount',
              'name your price',
              'pay what you want'
            ];
            
            for (const pattern of nypTextPatterns) {
              if (pageText.toLowerCase().includes(pattern.toLowerCase())) {
                isNYP = true;
                Logger.debug(`Detected NYP item by text pattern: "${pattern}"`);
                break;
              }
            }
          }
          
          // If we found NYP indicators, this is definitely NOT a fixed price item
          if (isNYP) {
            isFixedPrice = false;
          } else {
            // Only check for display-price elements if we haven't found NYP indicators
            // and look for elements that actually contain full prices, not just symbols
            const displayPriceElements = Array.from(document.querySelectorAll('span.display-price'));
            for (const element of displayPriceElements) {
              const text = element.textContent || '';
              const className = element.className || '';
              
              // Skip if this is clearly a NYP symbol (just currency symbol)
              if (className.includes('nyp') || text.trim().length <= 2) {
                continue;
              }
              
              // Look for actual price values (e.g., "$5.99", "€12.00")
              const priceRegex = /[\$€£¥]\s*\d+(\.\d{2})?/;
              if (priceRegex.test(text)) {
                isFixedPrice = true;
                Logger.debug('Detected fixed-price item by price value');
                break;
              }
            }
          }
        }
        
        // If it's a fixed price item, just click add to cart
        if (isFixedPrice) {
          setTimeout(() => {
            AddToCartUtils.clickAddToCartButton();
          }, 300);
          return;
        }
        
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
          'input[type="text"]', // Fallback - any text input
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
          if (priceInput) {
            break;
          }
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
          let minPrice = this.extractMinimumPrice();
          
          if (!minPrice) {
            // Fallback: use reasonable defaults based on currency and item type
            minPrice = this.getDefaultPrice(isTrack);
          }
          
          Logger.debug(`Auto-filling add to cart price: ${minPrice}`);
          
          // Check if the price is already filled
          if (priceInput.value && priceInput.value.trim() !== '') {
            // Only update if the current value looks like it might be a placeholder or default
            const currentValue = priceInput.value.trim();
            if (currentValue === '0' || currentValue === '0.00' || currentValue === '$0' || currentValue === '$0.00') {
              Logger.debug('Updating placeholder price value');
            } else {
              Logger.debug('Price already has valid value, proceeding to add to cart');
              setTimeout(() => {
                AddToCartUtils.clickAddToCartButton();
              }, 300);
              return;
            }
          }
          
          // Clear the current value and fill in the price
          priceInput.value = '';
          priceInput.value = minPrice;
          
          // Trigger events to ensure the change is registered
          priceInput.dispatchEvent(new Event('input', {bubbles: true}));
          priceInput.dispatchEvent(new Event('change', {bubbles: true}));
          priceInput.dispatchEvent(new Event('keyup', {bubbles: true}));
          
          // Focus the input to make it clear it's been filled
          priceInput.focus();
          
          // Also try triggering a blur event after a short delay to ensure validation
          setTimeout(() => {
            priceInput?.blur();
            priceInput?.focus();
          }, 100);
          
          // Auto-click "Add to cart" button after filling price
          setTimeout(() => {
            AddToCartUtils.clickAddToCartButton();
          }, 300);
        } else {
          Logger.warn('Could not find price input field in add to cart dialog');
          // Try to click add to cart anyway in case it's a fixed-price item we didn't detect
          setTimeout(() => {
            AddToCartUtils.clickAddToCartButton();
          }, 300);
        }
      } catch (error) {
        ErrorHandler.withErrorHandling(() => {
          throw error; 
        }, 'Error auto-filling buy price');
      }
    }, 500); // Give the dialog time to render
  }


  /**
   * Extract the minimum price from the buy dialog
   *
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
        /minimum.*?£([0-9]+\.?[0-9]*)/i,      // "minimum £1.50"
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
   *
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
}
