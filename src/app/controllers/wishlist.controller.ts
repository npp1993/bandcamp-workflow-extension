import {BandcampFacade} from '../facades/bandcamp.facade';
import {Logger} from '../utils/logger';
import {BulkCartService} from '../services/bulk-cart.service';

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

    // Show the controls footer when on wishlist pages (it will auto-hide if main player is visible)
    // The footer visibility will be managed by the observer

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
      
      // Create a fixed footer for our controls that matches the carousel player styling
      let controlsContainer = document.querySelector('.bandcamp-plus-controls-footer') as HTMLElement;
      
      if (!controlsContainer) {
        // Create a footer that shows only when the main player is not visible
        controlsContainer = document.createElement('div');
        controlsContainer.className = 'bandcamp-plus-controls-footer';
        controlsContainer.style.cssText = `
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 999;
          background-color: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-top: 1px solid #d3d3d3;
          padding: 10px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 60px;
          box-sizing: border-box;
          box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
        `;
        
        // Add it to the body
        document.body.appendChild(controlsContainer);
        
        // Set up observer to hide/show footer based on main player visibility
        this.setupFooterVisibilityObserver(controlsContainer);
      }

      // Create our stream button
      const streamButton = document.createElement('button');
      streamButton.className = 'bandcamp-plus-stream-button';
      streamButton.textContent = 'Stream Wishlist';
      streamButton.style.cssText = 'padding: 6px 12px; margin: 0 8px; cursor: pointer; background-color: #1da0c3; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold;';
      streamButton.title = 'Stream your wishlist - Press spacebar to play/pause, left/right arrows to navigate';
      
      streamButton.addEventListener('click', () => {
        BandcampFacade.startWishlistPlayback();
      });

      // Create our bulk cart button
      const bulkCartButton = document.createElement('button');
      bulkCartButton.className = 'bandcamp-plus-bulk-cart-button';
      bulkCartButton.textContent = 'Bulk Add to Cart';
      bulkCartButton.style.cssText = 'padding: 6px 12px; margin: 0 8px; cursor: pointer; background-color: #1da0c3; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold;';
      bulkCartButton.title = 'Add multiple items to cart - Press B key to enter bulk mode';
      
      bulkCartButton.addEventListener('click', () => {
        this.handleBulkCartAction();
      });

      // Set the button reference for the service
      BulkCartService.setBulkButton(bulkCartButton);

      // Create select all button
      const selectAllButton = document.createElement('button');
      selectAllButton.className = 'bandcamp-plus-select-all-button';
      selectAllButton.textContent = 'Select All';
      selectAllButton.style.cssText = 'padding: 6px 12px; margin: 0 8px; cursor: pointer; background-color: #28a745; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;';
      selectAllButton.title = 'Select all items - Press A key';
      
      selectAllButton.addEventListener('click', () => {
        BulkCartService.selectAllItems();
      });

      // Create deselect all button
      const deselectAllButton = document.createElement('button');
      deselectAllButton.className = 'bandcamp-plus-deselect-all-button';
      deselectAllButton.textContent = 'Deselect All';
      deselectAllButton.style.cssText = 'padding: 6px 12px; margin: 0 8px; cursor: pointer; background-color: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;';
      deselectAllButton.title = 'Deselect all items - Press D key';
      
      deselectAllButton.addEventListener('click', () => {
        BulkCartService.deselectAllItems();
      });

      // Set the additional button references for the service
      BulkCartService.setSelectAllButton(selectAllButton);
      BulkCartService.setDeselectAllButton(deselectAllButton);

      // Add the buttons to the controls container
      controlsContainer.appendChild(streamButton);
      controlsContainer.appendChild(bulkCartButton);
      controlsContainer.appendChild(selectAllButton);
      controlsContainer.appendChild(deselectAllButton);
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

  /**
   * Handle bulk cart button action
   */
  private handleBulkCartAction(): void {
    if (BulkCartService.isInBulkMode) {
      if (BulkCartService.isProcessing) {
        return; // Already processing
      }
      // In bulk mode, start processing selected items
      BulkCartService.processSelectedItems();
    } else {
      // Enter bulk mode
      const wishlistItems = BandcampFacade.loadWishlistItems();
      if (wishlistItems.length > 0) {
        BulkCartService.enterBulkMode(wishlistItems);
      } else {
        Logger.warn('No wishlist items found for bulk cart mode');
      }
    }
  }

  /**
   * Handle keyboard navigation in bulk mode
   */
  public static handleBulkModeKeyboard(event: KeyboardEvent): boolean {
    if (!BulkCartService.isInBulkMode) {
      return false;
    }

    switch (event.key.toLowerCase()) {
      case 'n':
        event.preventDefault();
        BulkCartService.navigateNext();
        return true;
      case 'p':
        event.preventDefault();
        BulkCartService.navigatePrevious();
        return true;
      case 'f':
        event.preventDefault();
        if (event.type === 'keydown' && !event.repeat) {
          // F key pressed down - enable continuous selection mode
          BulkCartService.setFKeyHeld(true);
          BulkCartService.toggleCurrentSelection();
        }
        return true;
      case 'a':
        event.preventDefault();
        BulkCartService.selectAllItems();
        return true;
      case 'd':
        event.preventDefault();
        BulkCartService.deselectAllItems();
        return true;
      case 'escape':
        event.preventDefault();
        BulkCartService.exitBulkMode();
        return true;
      case 'b':
        event.preventDefault();
        if (!BulkCartService.isProcessing) {
          BulkCartService.processSelectedItems();
        }
        return true;
      default:
        return false;
    }
  }

  /**
   * Handle keyboard key up events in bulk mode
   */
  public static handleBulkModeKeyUp(event: KeyboardEvent): boolean {
    if (!BulkCartService.isInBulkMode) {
      return false;
    }

    if (event.key.toLowerCase() === 'f') {
      // F key released - disable continuous selection mode
      BulkCartService.setFKeyHeld(false);
      return true;
    }

    return false;
  }

  /**
   * Setup observer to manage footer visibility based on main player state
   */
  private setupFooterVisibilityObserver(footer: HTMLElement): void {
    // Check initial state
    this.updateFooterVisibility(footer);
    
    // Set up a mutation observer to watch for changes in the DOM
    const observer = new MutationObserver(() => {
      this.updateFooterVisibility(footer);
    });
    
    // Observe changes to the body and its children
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    // Also check periodically in case the observer misses something
    setInterval(() => {
      this.updateFooterVisibility(footer);
    }, 2000);
  }

  /**
   * Update footer visibility based on main player state
   */
  private updateFooterVisibility(footer: HTMLElement): void {
    const mainPlayer = document.querySelector('.carousel-player') as HTMLElement;
    const playerInner = document.querySelector('.carousel-player-inner') as HTMLElement;
    
    // Check if the main player is visible and at the bottom
    let mainPlayerVisible = false;
    
    if (mainPlayer && playerInner) {
      const rect = mainPlayer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Check if player is visible and positioned at the bottom
      if (rect.height > 0 && rect.bottom >= viewportHeight - 50) {
        mainPlayerVisible = true;
      }
    }
    
    if (mainPlayerVisible) {
      // Hide our footer when main player is visible
      footer.style.display = 'none';
      document.body.style.paddingBottom = '0';
    } else {
      // Show our footer when main player is not visible
      footer.style.display = 'flex';
      document.body.style.paddingBottom = '60px';
    }
  }
}
