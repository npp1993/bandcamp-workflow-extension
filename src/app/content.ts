import { PageController } from './controllers/page.controller';
import { BandcampFacade } from './facades/bandcamp.facade';
import { AddToCartUtils } from './utils/add-to-cart-utils';
import { AlbumOnlyUtils } from './utils/album-only-utils';
import { Logger } from './utils/logger';

// Track current URL to detect navigation changes
let currentUrl = window.location.href;
let pageController: PageController | null = null;

/**
 * Checks if the current URL contains the close_tab_after_add parameter
 *
 * @returns boolean True if close_tab_after_add parameter is present and set to 'true'
 */
function hasCloseTabAfterAddParameter(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('close_tab_after_add') === 'true';
}

/**
 * Checks if the current URL contains the add_to_cart parameter
 *
 * @returns boolean True if add_to_cart parameter is present and set to 'true'
 */
function hasAddToCartParameter(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('add_to_cart') === 'true';
}

/**
 * Checks if the current URL contains the wishlist parameter
 *
 * @returns boolean True if wishlist parameter is present and set to 'true'
 */
function hasWishlistParameter(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('wishlist') === 'true';
}

/**
 * Handle wishlist functionality when navigating to a track page
 */
function handleWishlist(): void {
  // Check for wishlist parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const wishlist = urlParams.get('wishlist');

  if (wishlist === 'true') {
    // Wait for the page to fully load before attempting to toggle wishlist
    setTimeout(() => {
      // Check if we're on a track page
      if (BandcampFacade.isTrack) {
        BandcampFacade.toggleWishlist();
      }
    }, 2000); // Wait 2 seconds for the page to fully load
  }
}

/**
 * Handle add-to-cart functionality when navigating to a release page
 */
function handleAddToCart(): void {
  // Check for add_to_cart parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const addToCart = urlParams.get('add_to_cart');
  const closeTabAfterAdd = hasCloseTabAfterAddParameter();

  if (addToCart === 'true') {
    // Wait for the page to fully load before attempting to add to cart
    setTimeout(() => {
      // Check if we're on a release page
      if (BandcampFacade.isTrack) {
        // For track pages, we need to check if only album purchase is available
        // and handle it the same way as when hitting 'C' directly on the track page
        const { isAlbumOnly } = AlbumOnlyUtils.checkForAlbumOnlyPurchase();

        if (isAlbumOnly) {
          if (closeTabAfterAdd) {
            window.close();
          }
          return;
        }

        // If no album-only restriction detected, proceed with normal track purchase
        AddToCartUtils.clickAddToCartButtonOnCurrentPage();

        // Close tab after add to cart if requested
        if (closeTabAfterAdd) {
          // Wait a bit for the add to cart action to complete
          setTimeout(() => {
            window.close();
          }, 3000); // Wait 3 seconds for add to cart to process
        }
      } else if (BandcampFacade.isAlbum) {
        AddToCartUtils.clickAddToCartButtonOnCurrentPage();

        // Close tab after add to cart if requested
        if (closeTabAfterAdd) {
          // Wait a bit for the add to cart action to complete
          setTimeout(() => {
            window.close();
          }, 3000); // Wait 3 seconds for add to cart to process
        }
      } else {
        if (closeTabAfterAdd) {
          window.close();
        }
      }
    }, 2000); // Wait 2 seconds for the page to fully load
  }
}

/**
 * Initialize or reinitialize the extension
 */
function initializeExtension(): void {
  Logger.info(`Extension initializing for URL: ${window.location.href}`);

  // Clean up existing instance if any
  if (pageController) {
    Logger.info('Cleaning up existing PageController instance');
    // TODO: Add cleanup method to PageController if needed
  }

  // Reset the BandcampFacade to clear any cached values
  BandcampFacade.reset();

  // Initialize the page controller
  pageController = PageController.init();

  // Only call add-to-cart handler if the parameter is detected in the URL
  if (hasAddToCartParameter()) {
    handleAddToCart();
  }

  // Only call wishlist handler if the parameter is detected in the URL
  if (hasWishlistParameter()) {
    handleWishlist();
  }

  Logger.info('Extension initialization completed');
}

/**
 * Handle URL changes for SPA navigation
 */
function handleUrlChange(): void {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    Logger.info(
      `URL changed from ${currentUrl} to ${newUrl} - reinitializing extension`
    );
    currentUrl = newUrl;

    // Give the page a moment to update the DOM before reinitializing
    setTimeout(() => {
      initializeExtension();
    }, 500);
  }
}

// Listen for browser navigation events (back/forward)
window.addEventListener('popstate', () => {
  Logger.info('Popstate event detected - checking for URL change');
  handleUrlChange();
});

// Listen for programmatic navigation (pushState/replaceState)
// Override history methods to detect SPA navigation
const originalPushState = window.history.pushState;
const originalReplaceState = window.history.replaceState;

window.history.pushState = function (
  ...args: Parameters<typeof originalPushState>
): void {
  originalPushState.apply(window.history, args);
  Logger.info('PushState detected - checking for URL change');
  setTimeout(handleUrlChange, 100); // Small delay to ensure DOM updates
};

window.history.replaceState = function (
  ...args: Parameters<typeof originalReplaceState>
): void {
  originalReplaceState.apply(window.history, args);
  Logger.info('ReplaceState detected - checking for URL change');
  setTimeout(handleUrlChange, 100); // Small delay to ensure DOM updates
};

// Periodic check as fallback for any missed navigation events
setInterval(() => {
  handleUrlChange();
}, 2000); // Check every 2 seconds

// Initialize on page load
window.addEventListener('load', () => {
  Logger.info('Page load event - initializing extension');
  initializeExtension();
});

// Also initialize immediately if page is already loaded
if (document.readyState === 'complete') {
  Logger.info('Page already loaded - initializing extension immediately');
  initializeExtension();
}

// Monitor for URL changes (SPA navigation)
setInterval(handleUrlChange, 1000);
