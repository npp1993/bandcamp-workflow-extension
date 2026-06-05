import {AddToCartUtils} from '../add-to-cart-utils';
import {ErrorHandler} from '../error-handler';
import {Logger} from '../logger';

/**
 * Price detection and auto-fill of Bandcamp's name-your-price (NYP) buy dialog.
 *
 * Uses precise, dialog-scoped selectors verified against the live Bandcamp DOM:
 *   - input#userPrice.display-price.numeric  the NYP amount field
 *   - .nyp-summary-price                     the minimum, in seller currency ("€5", "€1.50")
 *   - .nyp-summary                           "(€5 or more)" fallback
 *   - .nyp-symbol                            the currency symbol
 * The presence of #userPrice is the definitive NYP signal; its absence means a
 * fixed-price item that needs no amount entered.
 */
export class AddToCartPrice {

  /**
   * Automatically fill the minimum price in the add-to-cart dialog, then add to
   * cart.
   *
   * @param isTrack Whether this is for a track (true) or album (false), used
   *   only to pick a fallback default when the minimum cannot be read.
   */
  public static autoFillAddToCartPrice(isTrack = true): void {
    // Give the dialog time to render before reading it.
    setTimeout(() => {
      try {
        const priceInput = document.querySelector('input#userPrice') as HTMLInputElement | null;

        // No NYP amount field -> fixed-price (or no price entry needed): just add.
        if (!priceInput) {
          Logger.debug('No NYP price input (#userPrice); treating as fixed-price item');
          setTimeout(() => AddToCartUtils.clickAddToCartButton(), 300);
          return;
        }

        // Read the exact minimum from the dialog; fall back to a default.
        const minPrice = this.extractMinimumPrice() ?? this.getDefaultPrice(isTrack);
        Logger.debug(`Auto-filling NYP price: ${minPrice}`);

        priceInput.value = minPrice;

        // Trigger events so Bandcamp's validation registers the value.
        priceInput.dispatchEvent(new Event('input', {bubbles: true}));
        priceInput.dispatchEvent(new Event('change', {bubbles: true}));
        priceInput.dispatchEvent(new Event('keyup', {bubbles: true}));
        priceInput.focus();
        setTimeout(() => {
          priceInput.blur();
          priceInput.focus();
        }, 100);

        // Add to cart once the value has registered.
        setTimeout(() => AddToCartUtils.clickAddToCartButton(), 300);
      } catch (error) {
        ErrorHandler.withErrorHandling(() => {
          throw error;
        }, 'Error auto-filling buy price');
      }
    }, 500);
  }


  /**
   * Read the NYP minimum from the buy dialog, in the seller's currency.
   *
   * Reads the dialog's own price elements directly rather than scanning the
   * whole page, so an unrelated "or more" price elsewhere on the page can never
   * be picked, and the value is parsed for both dot and comma decimals.
   *
   * @returns The minimum as a "0.00" string, or null if not found
   */
  private static extractMinimumPrice(): string | null {
    try {
      const sources = [
        document.querySelector('.nyp-summary-price'), // "€5" / "€1.50"
        document.querySelector('.nyp-summary'),       // "EUR (€5 or more)"
      ];
      for (const el of sources) {
        if (!el) {
          continue;
        }
        const price = this.parsePrice(el.textContent ?? '');
        if (price !== null) {
          return price.toFixed(2);
        }
      }
      return null;
    } catch (error) {
      Logger.error('Error extracting minimum price:', error);
      return null;
    }
  }


  /**
   * Parse a currency-formatted amount into a number, handling both decimal
   * conventions ("€1.50" and "€1,50") and thousands separators.
   *
   * @param raw Text containing a price (currency symbols/words are ignored)
   * @returns The positive amount, or null if none could be parsed
   */
  private static parsePrice(raw: string): number | null {
    // Keep only digits and separators, and drop any leading/trailing separators
    // (e.g. a trailing "." from "...or more.").
    const cleaned = raw.replace(/[^\d,.]/g, '').replace(/^[,.]+|[,.]+$/g, '');
    if (!cleaned) {
      return null;
    }

    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    let normalized: string;

    if (lastDot !== -1 && lastComma !== -1) {
      // Both present: the later separator is the decimal point.
      const decimalAt = Math.max(lastDot, lastComma);
      const intPart = cleaned.slice(0, decimalAt).replace(/[,.]/g, '');
      normalized = `${intPart}.${cleaned.slice(decimalAt + 1)}`;
    } else if (lastComma !== -1) {
      // Only commas: decimal if exactly two digits follow the last one, else
      // they are thousands separators.
      const decimals = cleaned.length - lastComma - 1;
      normalized = decimals === 2
        ? `${cleaned.slice(0, lastComma).replace(/,/g, '')}.${cleaned.slice(lastComma + 1)}`
        : cleaned.replace(/,/g, '');
    } else if (lastDot !== -1 && cleaned.indexOf('.') !== lastDot) {
      // Multiple dots: all but the last are thousands separators.
      normalized = `${cleaned.slice(0, lastDot).replace(/\./g, '')}.${cleaned.slice(lastDot + 1)}`;
    } else {
      normalized = cleaned;
    }

    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) && value > 0 ? value : null;
  }


  /**
   * Fallback default price when the minimum cannot be read from the dialog.
   * Currency is taken from the dialog's own symbol so a stray glyph elsewhere on
   * the page cannot flip it.
   *
   * @param isTrack Whether this is for a track (true) or album (false)
   * @returns Default price as string
   */
  private static getDefaultPrice(isTrack: boolean): string {
    try {
      const currencyText = [
        document.querySelector('.nyp-symbol'),
        document.querySelector('.nyp-summary-price'),
        document.querySelector('.nyp-summary'),
      ].map((el) => el?.textContent?.trim()).find(Boolean)
        ?? document.body.textContent ?? '';

      if (currencyText.includes('€') || currencyText.includes('EUR')) {
        return isTrack ? '1.00' : '5.00';
      } else if (currencyText.includes('£') || currencyText.includes('GBP')) {
        return isTrack ? '0.80' : '4.00';
      } else if (currencyText.includes('¥') || currencyText.includes('JPY')) {
        return isTrack ? '100' : '500';
      } else if (currencyText.includes('CAD')) {
        return isTrack ? '1.25' : '6.25';
      } else {
        return isTrack ? '1.00' : '5.00';
      }
    } catch (error) {
      Logger.error('Error determining default price:', error);
      return isTrack ? '1.00' : '5.00';
    }
  }
}
