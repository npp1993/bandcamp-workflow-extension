import {PageController} from './controllers/page.controller';
import {BandcampFacade} from './facades/bandcamp.facade';
import {Logger} from './utils/logger';
import {AlbumOnlyUtils} from './utils/album-only-utils';

/**
 * Checks if the current URL contains the add_to_cart parameter
 * @returns boolean True if add_to_cart parameter is present and set to 'true'
 */
function hasAddToCartParameter(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('add_to_cart') === 'true';
}

/**
 * Handle add-to-cart functionality when navigating to a release page
 */
function handleAddToCart() {
  Logger.info('Checking for add_to_cart parameter in URL');
  
  // Check for add_to_cart parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const addToCart = urlParams.get('add_to_cart');
  Logger.info('Add-to-cart parameter value:', addToCart);
  
  if (addToCart === 'true') {
    Logger.info('Add-to-cart parameter detected, will attempt to purchase track/album');
    
    // Wait for the page to fully load before attempting to add to cart
    Logger.info('Waiting for page to fully load before attempting to add to cart...');
    setTimeout(() => {
      // Check if we're on a release page
      Logger.info('Page loaded. Checking if we are on a release page. isTrack:', 
        BandcampFacade.isTrack, 'isAlbum:', BandcampFacade.isAlbum);
      
      if (BandcampFacade.isTrack) {
        Logger.info('On a track page, using track-specific workflow to handle album-only restrictions');
        // For track pages, we need to check if only album purchase is available
        // and handle it the same way as when hitting 'C' directly on the track page
        const { isAlbumOnly } = AlbumOnlyUtils.checkForAlbumOnlyPurchase();
        
        if (isAlbumOnly) {
          Logger.info('Track page only allows album purchase, ignoring add_to_cart parameter as expected');
          return;
        }
        
        // If no album-only restriction detected, proceed with normal track purchase
        Logger.info('No album-only restriction detected, clicking add to cart button');
        BandcampFacade.clickAddToCartButtonOnCurrentPage();
        
      } else if (BandcampFacade.isAlbum) {
        Logger.info('On an album page, attempting to add to cart');
        BandcampFacade.clickAddToCartButtonOnCurrentPage();
      } else {
        Logger.info('Not on a release page, skipping add to cart button click');
        Logger.info('Page URL:', window.location.href);
        Logger.info('Page title:', document.title);
      }
    }, 2000); // Wait 2 seconds for the page to fully load
  } else {
    Logger.info('No add-to-cart parameter detected, skipping purchase process');
  }
}

window.addEventListener('load', () => {
  Logger.info('Page loaded, initializing extension');
  PageController.init();
  
  // Only call add-to-cart handler if the parameter is detected in the URL
  if (hasAddToCartParameter()) {
    Logger.info('Add-to-cart parameter found in URL, activating purchase flow');
    handleAddToCart();
  } else {
    Logger.info('No add-to-cart parameter in URL, skipping purchase flow');
  }
  
  Logger.info('Extension initialization completed');
});
