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
  }  /**
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
            
            // Add controls to the sidebar
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
   * Add wishlist controls to the sidebar
   */
  private addWishlistControls(): void {
    try {
      // Get the existing sidebar container (created during loading)
      const controlsContainer = this.createSidebarContainer();
      
      // Clear any loading content
      controlsContainer.innerHTML = '';

      // Create our bulk cart button
      const bulkCartButton = document.createElement('button');
      bulkCartButton.className = 'bandcamp-workflow-bulk-cart-button';
      bulkCartButton.textContent = 'Bulk Add to Cart (B)';
      bulkCartButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #1da0c3; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold;';
      bulkCartButton.title = 'Add multiple items to cart - Press B key to enter bulk mode';
      
      bulkCartButton.addEventListener('click', () => {
        this.handleBulkCartAction();
      });

      // Set the button reference for the service
      BulkCartService.setBulkButton(bulkCartButton);

      // Create navigation buttons (hidden by default, shown in bulk mode)
      const prevButton = document.createElement('button');
      prevButton.className = 'bandcamp-workflow-prev-button';
      prevButton.textContent = 'Previous (P)';
      prevButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #6c757d; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;';
      prevButton.title = 'Navigate to previous item - Press P key';
      
      prevButton.addEventListener('click', () => {
        BulkCartService.navigatePrevious();
      });

      const nextButton = document.createElement('button');
      nextButton.className = 'bandcamp-workflow-next-button';
      nextButton.textContent = 'Next (N)';
      nextButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #6c757d; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;';
      nextButton.title = 'Navigate to next item - Press N key';
      
      nextButton.addEventListener('click', () => {
        BulkCartService.navigateNext();
      });

      // Create toggle selection button (hidden by default, shown in bulk mode)
      const toggleSelectionButton = document.createElement('button');
      toggleSelectionButton.className = 'bandcamp-workflow-toggle-selection-button';
      toggleSelectionButton.textContent = 'Toggle Selection (F)';
      toggleSelectionButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #fd7e14; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;';
      toggleSelectionButton.title = 'Toggle selection of current item - Press F key';
      
      toggleSelectionButton.addEventListener('click', () => {
        BulkCartService.toggleCurrentSelection();
      });

      // Create select all button
      const selectAllButton = document.createElement('button');
      selectAllButton.className = 'bandcamp-workflow-select-all-button';
      selectAllButton.textContent = 'Select All (A)';
      selectAllButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #28a745; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;';
      selectAllButton.title = 'Select all items - Press A key';
      
      selectAllButton.addEventListener('click', () => {
        BulkCartService.selectAllItems();
      });

      // Create deselect all button
      const deselectAllButton = document.createElement('button');
      deselectAllButton.className = 'bandcamp-workflow-deselect-all-button';
      deselectAllButton.textContent = 'Deselect All (D)';
      deselectAllButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #dc3545; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;';
      deselectAllButton.title = 'Deselect all items - Press D key';
      
      deselectAllButton.addEventListener('click', () => {
        BulkCartService.deselectAllItems();
      });

      // Create exit bulk mode button (hidden by default, shown in bulk mode)
      const exitBulkButton = document.createElement('button');
      exitBulkButton.className = 'bandcamp-workflow-exit-bulk-button';
      exitBulkButton.textContent = 'Exit Bulk Mode (Esc)';
      exitBulkButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #6f42c1; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;';
      exitBulkButton.title = 'Exit bulk selection mode - Press Esc key';
      
      exitBulkButton.addEventListener('click', () => {
        BulkCartService.exitBulkMode();
      });

      // Set the button references for the service
      BulkCartService.setSelectAllButton(selectAllButton);
      BulkCartService.setDeselectAllButton(deselectAllButton);
      BulkCartService.setPrevButton(prevButton);
      BulkCartService.setNextButton(nextButton);
      BulkCartService.setToggleSelectionButton(toggleSelectionButton);
      BulkCartService.setExitBulkButton(exitBulkButton);

      // Add the buttons to the controls container
      controlsContainer.appendChild(bulkCartButton);
      controlsContainer.appendChild(prevButton);
      controlsContainer.appendChild(nextButton);
      controlsContainer.appendChild(toggleSelectionButton);
      controlsContainer.appendChild(selectAllButton);
      controlsContainer.appendChild(deselectAllButton);
      controlsContainer.appendChild(exitBulkButton);
    } catch (error) {
      Logger.error('Error adding wishlist controls:', error);
    }
  }

  /**
   * Create or get the sidebar container
   */
  private createSidebarContainer(): HTMLElement {
    let controlsContainer = document.querySelector('.bandcamp-workflow-controls-sidebar') as HTMLElement;
    
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.className = 'bandcamp-workflow-controls-sidebar';
      controlsContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        background-color: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid #d3d3d3;
        border-radius: 8px;
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-sizing: border-box;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        max-height: calc(100vh - 40px);
        overflow-y: auto;
      `;
      
      // Add it to the body
      document.body.appendChild(controlsContainer);
    }
    
    return controlsContainer;
  }

  /**
   * Show a loading message in the sidebar
   */
  private showLoadingIndicator(): void {
    try {
      const sidebar = this.createSidebarContainer();
      
      // Clear any existing content
      sidebar.innerHTML = '';
      
      // Create loading message
      const loadingMessage = document.createElement('div');
      loadingMessage.id = 'bandcamp-workflow-loading-message';
      loadingMessage.textContent = 'Loading wishlist items...';
      
      sidebar.appendChild(loadingMessage);
    } catch (error) {
      Logger.error('Error showing loading indicator:', error);
    }
  }

  /**
   * Hide the loading indicator and prepare sidebar for controls
   */
  private hideLoadingIndicator(): void {
    try {
      const sidebar = document.querySelector('.bandcamp-workflow-controls-sidebar') as HTMLElement;
      if (sidebar) {
        // Clear the loading message
        const loadingMessage = document.getElementById('bandcamp-workflow-loading-message');
        if (loadingMessage) {
          loadingMessage.remove();
        }
      }
      
      // Remove the old separate loading indicator if it still exists
      const oldIndicator = document.getElementById('bandcamp-workflow-loading');
      if (oldIndicator) {
        oldIndicator.remove();
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
}
