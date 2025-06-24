import {PageController} from './controllers/page.controller';
import {BandcampFacade} from './facades/bandcamp.facade';
import {AlbumOnlyUtils} from './utils/album-only-utils';
import {Logger} from './utils/logger';

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
    Logger.info('Wishlist parameter detected, will attempt to toggle wishlist for track');
    
    // Wait for the page to fully load before attempting to toggle wishlist
    setTimeout(() => {
      // Check if we're on a track page
      if (BandcampFacade.isTrack) {
        Logger.info('On track page, toggling wishlist');
        BandcampFacade.toggleWishlist();
      } else {
        Logger.info('Not on a track page, skipping wishlist toggle');
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
  
  if (addToCart === 'true') {
    Logger.info('Add-to-cart parameter detected, will attempt to purchase track/album');
    
    // Wait for the page to fully load before attempting to add to cart
    setTimeout(() => {
      // Check if we're on a release page
      if (BandcampFacade.isTrack) {
        // For track pages, we need to check if only album purchase is available
        // and handle it the same way as when hitting 'C' directly on the track page
        const {isAlbumOnly} = AlbumOnlyUtils.checkForAlbumOnlyPurchase();
        
        if (isAlbumOnly) {
          Logger.info('Track page only allows album purchase, ignoring add_to_cart parameter as expected');
          return;
        }
        
        // If no album-only restriction detected, proceed with normal track purchase
        BandcampFacade.clickAddToCartButtonOnCurrentPage();
      } else if (BandcampFacade.isAlbum) {
        BandcampFacade.clickAddToCartButtonOnCurrentPage();
      } else {
        Logger.info('Not on a release page, skipping add to cart button click');
      }
    }, 2000); // Wait 2 seconds for the page to fully load
  }
}

window.addEventListener('load', () => {
  Logger.info('Extension initializing');
  PageController.init();
  
  // Only call add-to-cart handler if the parameter is detected in the URL
  if (hasAddToCartParameter()) {
    handleAddToCart();
  }
  
  // Only call wishlist handler if the parameter is detected in the URL
  if (hasWishlistParameter()) {
    handleWishlist();
  }
  
  Logger.info('Extension initialization completed');
});
