import {BandcampFacade} from '../facades/bandcamp.facade';

/**
 * Controller for the wishlist page
 * Handles streaming tracks from the wishlist page
 */
export class WishlistController {
  private hasInitialized = false;

  constructor() {
    if (!BandcampFacade.isWishlistPage) {
      return;
    }

    this.initialize();
  }

  /**
   * Initialize the wishlist controller
   */
  private initialize(): void {
    if (this.hasInitialized) {
      return;
    }

    // Wait for the page to fully load
    setTimeout(() => {
      try {
        // Load wishlist items
        BandcampFacade.loadWishlistItems();
        
        // Setup continuous playback
        BandcampFacade.setupWishlistContinuousPlayback();
        
        // Add controls to the page
        this.addWishlistControls();
        
        this.hasInitialized = true;
      } catch (error) {
        console.error('Error initializing wishlist controller:', error);
      }
    }, 1000);
  }

  /**
   * Add wishlist controls to the page
   */
  private addWishlistControls(): void {
    try {
      // Try different possible containers
      let container = null;
      const possibleContainers = [
        '.collection-header',
        '.fan-collection-header',
        '.collection-title-details',
        '.collection-items',
        '#collection-items',
        '.collection-grid',
        '.fan-collection',
        '#fan-collection'
      ];

      // Find the first container that exists
      for (const selector of possibleContainers) {
        const element = document.querySelector(selector);
        if (element) {
          container = element;
          break;
        }
      }

      // If we still don't have a container, create one at the top of the body
      if (!container) {
        console.warn('Could not find suitable container for wishlist controls, creating one');
        container = document.createElement('div');
        container.className = 'bandcamp-plus-created-container';
        container.style.cssText = 'padding: 20px; margin: 0 auto; max-width: 1140px;';
        
        const mainContent = document.querySelector('#pagedata')?.parentElement;
        if (mainContent) {
          mainContent.insertBefore(container, mainContent.firstChild);
        } else {
          document.body.insertBefore(container, document.body.firstChild);
        }
      }

      // Create control container
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'bandcamp-plus__wishlist-controls';
      controlsContainer.style.cssText = 'padding: 10px; margin: 10px 0; background-color: rgba(0,0,0,0.05); border-radius: 4px;';

      // Create play all button
      const playAllButton = document.createElement('button');
      playAllButton.textContent = 'Stream Wishlist';
      playAllButton.style.cssText = 'padding: 5px 15px; margin-right: 10px; cursor: pointer; background-color: #1da0c3; color: white; border: none; border-radius: 4px;';
      playAllButton.addEventListener('click', () => {
        BandcampFacade.startWishlistPlayback();
      });

      // Create info text
      const infoText = document.createElement('span');
      infoText.textContent = 'Use left/right arrow keys or P/N to navigate tracks';
      infoText.style.cssText = 'margin-left: 10px; color: #666;';

      // Add elements to container
      controlsContainer.appendChild(playAllButton);
      controlsContainer.appendChild(infoText);

      // Add container to page - append as the first child if possible
      if (container.firstChild) {
        container.insertBefore(controlsContainer, container.firstChild);
      } else {
        container.appendChild(controlsContainer);
      }
    } catch (error) {
      console.error('Error adding wishlist controls:', error);
    }
  }
}