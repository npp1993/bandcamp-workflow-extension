import {BandcampFacade} from '../facades/bandcamp.facade';
import {Logger} from '../utils/logger';

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
        // Add a visual indicator that we're loading
        this.showLoadingIndicator();
        
        // First, load all wishlist items by clicking the "view all" button
        Logger.info('Initializing wishlist controller - checking if all items need to be loaded...');
        BandcampFacade.loadAllWishlistItems().then((success) => {
          if (success) {
            Logger.info('All wishlist items are now loaded');
          } else {
            Logger.info('Unable to load all wishlist items, proceeding with visible items');
          }
          
          // Now load the wishlist items that are visible
          const items = BandcampFacade.loadWishlistItems();
          
          if (items.length > 0) {
            // Setup continuous playback
            BandcampFacade.setupWishlistContinuousPlayback();
            
            // Add controls to the player
            this.addWishlistControls();
            
            // Remove loading indicator and show success message
            this.hideLoadingIndicator();
            Logger.info(`Wishlist controller initialized with ${items.length} items. Press spacebar to start playing.`);
          } else {
            this.hideLoadingIndicator();
            Logger.warn('No wishlist items found during initialization');
          }
          
          this.hasInitialized = true;
        }).catch((error) => {
          Logger.error('Error loading all wishlist items:', error);
          
          // Fall back to just loading visible items
          const items = BandcampFacade.loadWishlistItems();
          
          if (items.length > 0) {
            BandcampFacade.setupWishlistContinuousPlayback();
            this.addWishlistControls();
            Logger.info(`Wishlist controller initialized in fallback mode with ${items.length} items.`);
          }
          
          this.hideLoadingIndicator();
          this.hasInitialized = true;
        });
      } catch (error) {
        Logger.error('Error initializing wishlist controller:', error);
        this.hideLoadingIndicator();
        this.hasInitialized = true;
      }
    }, 1000);
  }

  /**
   * Add wishlist controls to the player area
   */
  private addWishlistControls(): void {
    try {
      // Look for the player controls
      const playerSelectors = [
        '.carousel-player-inner .controls-extra',
        '.carousel-player-inner .col-4-15.controls-extra',
        '.col.controls-extra',
        '.col.col-4-15.controls-extra',
      ];
      
      let controlsContainer: HTMLElement | null = null;
      
      // Try to find the player controls
      for (const selector of playerSelectors) {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
          controlsContainer = element;
          break;
        }
      }
      
      // If we couldn't find the player controls, try to find the player itself
      if (!controlsContainer) {
        const playerElement = document.querySelector('.carousel-player-inner') as HTMLElement;
        if (playerElement) {
          // Create a new div to add to the player
          controlsContainer = document.createElement('div');
          controlsContainer.className = 'col col-4-15 bandcamp-plus-controls';
          controlsContainer.style.cssText = 'display: flex; align-items: center; justify-content: center;';
          
          // Add it to the player
          playerElement.appendChild(controlsContainer);
        } else {
          Logger.warn('Could not find player element to add controls');
          return;
        }
      }

      // Create our stream button
      const streamButton = document.createElement('button');
      streamButton.className = 'bandcamp-plus-stream-button';
      streamButton.textContent = 'Stream Wishlist';
      streamButton.style.cssText = 'padding: 8px 15px; margin: 0 10px; cursor: pointer; background-color: #1da0c3; color: white; border: none; border-radius: 4px; font-size: 13px; font-weight: bold;';
      streamButton.title = 'Stream your wishlist - Press spacebar to play/pause, left/right arrows to navigate';
      
      streamButton.addEventListener('click', () => {
        BandcampFacade.startWishlistPlayback();
      });

      // Add the button to the controls container
      controlsContainer.appendChild(streamButton);
    } catch (error) {
      Logger.error('Error adding wishlist controls:', error);
    }
  }

  /**
   * Show a loading indicator while wishlist items are being loaded
   */
  private showLoadingIndicator(): void {
    try {
      // Create a subtle loading indicator
      const indicator = document.createElement('div');
      indicator.id = 'bandcamp-plus-loading';
      indicator.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(29, 160, 195, 0.9);
          color: white;
          padding: 10px 15px;
          border-radius: 4px;
          font-size: 13px;
          z-index: 10000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        ">
          <span>Loading wishlist items...</span>
        </div>
      `;
      document.body.appendChild(indicator);
    } catch (error) {
      Logger.error('Error showing loading indicator:', error);
    }
  }

  /**
   * Hide the loading indicator
   */
  private hideLoadingIndicator(): void {
    try {
      const indicator = document.getElementById('bandcamp-plus-loading');
      if (indicator) {
        indicator.remove();
      }
    } catch (error) {
      Logger.error('Error hiding loading indicator:', error);
    }
  }
}
