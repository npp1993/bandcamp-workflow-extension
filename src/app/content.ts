import {PageController} from './controllers/page.controller';
import {BandcampFacade} from './facades/bandcamp.facade';

/**
 * Checks if the current URL contains the auto_buy parameter
 * @returns boolean True if auto_buy parameter is present and set to 'true'
 */
function hasAutoBuyParameter(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('auto_buy') === 'true';
}

/**
 * Handle auto-buy functionality when navigating to a release page
 */
function handleAutoBuy() {
  console.log('Checking for auto-buy parameter in URL');
  
  // Check for auto_buy parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const autoBuy = urlParams.get('auto_buy');
  console.log('Auto-buy parameter value:', autoBuy);
  
  if (autoBuy === 'true') {
    console.log('Auto-buy parameter detected, will attempt to purchase track/album');
    
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
    console.log('No auto-buy parameter detected, skipping purchase process');
  }
}

window.addEventListener('load', () => {
  console.log('Page loaded, initializing extension');
  PageController.init();
  
  // Only call auto-buy handler if the parameter is detected in the URL
  if (hasAutoBuyParameter()) {
    console.log('Auto-buy parameter found in URL, activating purchase flow');
    handleAutoBuy();
  } else {
    console.log('No auto-buy parameter in URL, skipping purchase flow');
  }
  
  console.log('Extension initialization completed');
});
