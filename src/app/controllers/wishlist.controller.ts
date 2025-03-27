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
        const items = BandcampFacade.loadWishlistItems();
        
        if (items.length > 0) {
          // Setup continuous playback
          BandcampFacade.setupWishlistContinuousPlayback();
          
          // Add controls to the player
          this.addWishlistControls();
          
          console.log('Wishlist controller initialized. Press spacebar to start playing.');
        } else {
          console.warn('No wishlist items found during initialization');
        }
        
        this.hasInitialized = true;
      } catch (error) {
        console.error('Error initializing wishlist controller:', error);
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
        '.col.col-4-15.controls-extra'
      ];
      
      let controlsContainer: HTMLElement = null;
      
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
          console.warn('Could not find player element to add controls');
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
      console.error('Error adding wishlist controls:', error);
    }
  }
}