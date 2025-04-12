import {PageController} from './controllers/page.controller';
import {BandcampFacade} from './facades/bandcamp.facade';

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
  console.log('Checking for add_to_cart parameter in URL');
  
  // Check for add_to_cart parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const addToCart = urlParams.get('add_to_cart');
  console.log('Add-to-cart parameter value:', addToCart);
  
  if (addToCart === 'true') {
    console.log('Add-to-cart parameter detected, will attempt to purchase track/album');
    
    // Wait for the page to fully load before attempting to buy
    console.log('Waiting for page to fully load before attempting to buy...');
    setTimeout(() => {
      // Check if we're on a release page
      console.log('Page loaded. Checking if we are on a release page. isTrack:', 
        BandcampFacade.isTrack, 'isAlbum:', BandcampFacade.isAlbum);
      
      if (BandcampFacade.isTrack || BandcampFacade.isAlbum) {
        console.log('On a release page, attempting to click buy button');
        BandcampFacade.clickBuyButtonOnCurrentPage();
      } else {
        console.log('Not on a release page, skipping buy button click');
        console.log('Page URL:', window.location.href);
        console.log('Page title:', document.title);
      }
    }, 2000); // Wait 2 seconds for the page to fully load
  } else {
    console.log('No add-to-cart parameter detected, skipping purchase process');
  }
}

window.addEventListener('load', () => {
  console.log('Page loaded, initializing extension');
  PageController.init();
  
  // Only call add-to-cart handler if the parameter is detected in the URL
  if (hasAddToCartParameter()) {
    console.log('Add-to-cart parameter found in URL, activating purchase flow');
    handleAddToCart();
  } else {
    console.log('No add-to-cart parameter in URL, skipping purchase flow');
  }
  
  console.log('Extension initialization completed');
});
