import {BandcampFacade} from '../facades/bandcamp.facade';
import {Logger} from '../utils/logger';
import {BulkCartService} from '../services/bulk-cart.service';
import {ShuffleService} from '../services/shuffle.service';

/**
 * Controller for collection-based pages (wishlist and collection)
 * Handles streaming tracks from collection-based pages
 */
export class WishlistController {
  private hasInitialized = false;
  private collectionObserver: MutationObserver | null = null;
  private globalObserver: MutationObserver | null = null;
  private periodicCheckInterval: number | null = null;

  constructor() {
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
        
        // For wishlist pages, try to load all items by clicking the "view all" button
        // For collection pages, skip this step and proceed directly to loading visible items
        if (BandcampFacade.isWishlistPage) {
          BandcampFacade.loadAllWishlistItems().then((success) => {
            this.initializeItemsAndControls();
          }).catch((error) => {
            Logger.error('Error loading all wishlist items:', error);
            this.initializeItemsAndControls();
          });
        } else if (BandcampFacade.isCollectionPage) {
          this.initializeItemsAndControls();
        } else {
          Logger.warn('Not on a recognized collection-based page');
          this.hideLoadingIndicator();
          this.hasInitialized = true;
        }
      } catch (error) {
        Logger.error('Error initializing wishlist controller:', error);
        this.hideLoadingIndicator();
        this.hasInitialized = true;
      }
    }, 1000);
  }

  /**
   * Initialize items and controls (shared logic for both wishlist and collection pages)
   */
  private initializeItemsAndControls(): void {
    try {
      // Now load the items that are visible
      const items = BandcampFacade.loadWishlistItems();
      
      if (items.length > 0) {
        // Setup continuous playback
        BandcampFacade.setupWishlistContinuousPlayback();
        
        // Add controls to the sidebar (different controls based on page type)
        if (BandcampFacade.isWishlistPage) {
          this.addWishlistControls();
        } else if (BandcampFacade.isCollectionPage) {
          this.addCollectionControls();
          // Set up observer to watch for new collection items being loaded
          this.setupCollectionItemObserver();
          // Also set up a global observer as backup
          this.setupGlobalCollectionObserver();
          // Set up periodic checking as final failsafe
          this.setupPeriodicItemCheck();
        }
        
        // Remove loading indicator and show success message
        this.hideLoadingIndicator();
      } else {
        this.hideLoadingIndicator();
        const pageType = BandcampFacade.isWishlistPage ? 'wishlist' : 'collection';
        Logger.warn(`No ${pageType} items found during initialization`);
      }
      
      this.hasInitialized = true;
    } catch (error) {
      Logger.error('Error in initializeItemsAndControls:', error);
      this.hideLoadingIndicator();
      this.hasInitialized = true;
    }
  }

  /**
   * Setup mutation observer to watch for new collection items being loaded
   */
  private setupCollectionItemObserver(): void {
    if (this.collectionObserver) {
      this.collectionObserver.disconnect();
    }

    // Find the collection container to observe
    const collectionContainer = document.querySelector('#collection-grid, [data-grid-id="collection-grid"], .collection-content') as HTMLElement;
    
    if (!collectionContainer) {
      Logger.warn('No collection container found for mutation observer');
      return;
    }

    Logger.info('Setting up collection item observer on container:', collectionContainer.className);
    Logger.info('Container element details:', {
      id: collectionContainer.id,
      className: collectionContainer.className,
      tagName: collectionContainer.tagName,
      childElementCount: collectionContainer.childElementCount
    });

    let previousItemCount = BandcampFacade.loadWishlistItems().length;
    Logger.info(`Initial item count for observer: ${previousItemCount}`);
    
    this.collectionObserver = new MutationObserver((mutations) => {
      Logger.info(`Collection observer triggered with ${mutations.length} mutations`);
      
      // Log all mutations for debugging
      mutations.forEach((mutation, index) => {
        Logger.info(`Mutation ${index + 1}:`, {
          type: mutation.type,
          target: `${mutation.target.nodeName}.${(mutation.target as HTMLElement).className}`,
          addedNodes: mutation.addedNodes.length,
          removedNodes: mutation.removedNodes.length
        });
        
        if (mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              Logger.info(`Added node ${i + 1}:`, {
                tagName: element.tagName,
                className: element.className,
                id: element.id,
                isCollectionItem: element.classList.contains('collection-item-container') || 
                                 element.classList.contains('collection-item'),
                hasCollectionItemChild: !!element.querySelector('.collection-item-container, .collection-item')
              });
            }
          }
        }
      });
      
      // Check if any new child nodes were added that might be collection items
      let hasNewItems = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes are collection items
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (element.classList.contains('collection-item-container') || 
                  element.classList.contains('collection-item') ||
                  element.querySelector('.collection-item-container, .collection-item')) {
                hasNewItems = true;
                Logger.info('Detected new collection item:', element.className);
                break;
              }
            }
          }
          if (hasNewItems) break;
        }
      }

      // Always check item count after any DOM change, not just when we think items were added
      setTimeout(() => {
        const currentItems = BandcampFacade.loadWishlistItems();
        const currentItemCount = currentItems.length;
        
        Logger.info(`Item count check: ${previousItemCount} → ${currentItemCount} (hasNewItems: ${hasNewItems})`);
        
        if (currentItemCount > previousItemCount) {
          Logger.info(`Collection observer detected ${currentItemCount - previousItemCount} new items (${previousItemCount} → ${currentItemCount})`);
          
          // Update shuffle order if shuffle mode is enabled
          if (ShuffleService.isShuffleEnabled) {
            Logger.info(`Shuffle mode enabled, updating shuffle order for new collection items`);
            ShuffleService.updateShuffleOrderForNewItems('collection', currentItemCount, BandcampFacade.currentWishlistIndex >= 0 ? BandcampFacade.currentWishlistIndex : 0);
          }
          
          previousItemCount = currentItemCount;
        } else if (currentItemCount !== previousItemCount) {
          Logger.info(`Item count changed unexpectedly: ${previousItemCount} → ${currentItemCount}`);
          previousItemCount = currentItemCount;
        }
      }, 500);
    });

    // Start observing for child additions in the collection container
    this.collectionObserver.observe(collectionContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
    
    Logger.info('Collection mutation observer is now active');
  }

  /**
   * Setup a global mutation observer as backup to catch any collection item changes
   */
  private setupGlobalCollectionObserver(): void {
    if (this.globalObserver) {
      this.globalObserver.disconnect();
    }

    let previousItemCount = BandcampFacade.loadWishlistItems().length;
    let lastCheckTime = Date.now();
    
    Logger.info('Setting up global collection observer as backup');
    
    this.globalObserver = new MutationObserver((mutations) => {
      const now = Date.now();
      // Throttle to avoid excessive checking (max once per 2 seconds)
      if (now - lastCheckTime < 2000) {
        return;
      }
      lastCheckTime = now;
      
      // Check if we're still on a collection page
      if (!BandcampFacade.isCollectionPage) {
        return;
      }
      
      // Check for collection-related mutations
      let hasCollectionRelatedChanges = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const target = mutation.target as HTMLElement;
          if (target.id === 'collection-grid' || 
              target.className.includes('collection') ||
              target.className.includes('grid') ||
              Array.from(mutation.addedNodes).some(node => 
                node.nodeType === Node.ELEMENT_NODE && 
                (node as HTMLElement).className.includes('collection-item')
              )) {
            hasCollectionRelatedChanges = true;
            Logger.info('Global observer detected collection-related DOM changes');
            break;
          }
        }
      }
      
      if (hasCollectionRelatedChanges) {
        setTimeout(() => {
          const currentItems = BandcampFacade.loadWishlistItems();
          const currentItemCount = currentItems.length;
             if (currentItemCount > previousItemCount) {
          Logger.info(`Global observer detected ${currentItemCount - previousItemCount} new items (${previousItemCount} → ${currentItemCount})`);
          
          // Update shuffle order if shuffle mode is enabled
          Logger.info(`Checking shuffle mode: enabled=${ShuffleService.isShuffleEnabled}`);
          if (ShuffleService.isShuffleEnabled) {
            Logger.info(`Shuffle mode enabled, updating shuffle order for new collection items (global observer)`);
            ShuffleService.updateShuffleOrderForNewItems('collection', currentItemCount, BandcampFacade.currentWishlistIndex >= 0 ? BandcampFacade.currentWishlistIndex : 0);
          } else {
            Logger.info(`Shuffle mode not enabled, skipping shuffle order update`);
          }
          
          previousItemCount = currentItemCount;
        }
        }, 1000);
      }
    });

    // Observe the entire document body with limited scope
    this.globalObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
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

      // Create shuffle button
      const shuffleButton = document.createElement('button');
      shuffleButton.className = 'bandcamp-workflow-shuffle-button';
      shuffleButton.textContent = 'Shuffle: OFF (S)';
      shuffleButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #6c757d; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; margin-top: 5px;';
      shuffleButton.title = 'Toggle shuffle mode for next track navigation - Press S key';
      
      shuffleButton.addEventListener('click', () => {
        ShuffleService.toggleShuffle();
      });

      // Set the button reference for the shuffle service
      ShuffleService.setShuffleButton(shuffleButton);

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

      // Add the buttons to the controls container (shuffle first, then bulk cart)
      controlsContainer.appendChild(shuffleButton);
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
   * Add collection controls to the sidebar (shuffle only, no bulk cart features)
   */
  private addCollectionControls(): void {
    try {
      // Get the existing sidebar container (created during loading)
      const controlsContainer = this.createSidebarContainer();
      
      // Clear any loading content
      controlsContainer.innerHTML = '';

      // Create shuffle button (only control available on collection pages)
      const shuffleButton = document.createElement('button');
      shuffleButton.className = 'bandcamp-workflow-shuffle-button';
      shuffleButton.textContent = 'Shuffle: OFF (S)';
      shuffleButton.style.cssText = 'padding: 8px 12px; cursor: pointer; background-color: #6c757d; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: bold;';
      shuffleButton.title = 'Toggle shuffle mode for next track navigation - Press S key';
      
      shuffleButton.addEventListener('click', () => {
        ShuffleService.toggleShuffle();
      });

      // Set the button reference for the shuffle service
      ShuffleService.setShuffleButton(shuffleButton);

      // Add the shuffle button to the controls container
      controlsContainer.appendChild(shuffleButton);
    } catch (error) {
      Logger.error('Error adding collection controls:', error);
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
   * Clean up the sidebar when navigating away from collection-based pages
   */
  public static cleanup(): void {
    const controlsContainer = document.querySelector('.bandcamp-workflow-controls-sidebar') as HTMLElement;
    if (controlsContainer) {
      controlsContainer.remove();
    }
  }

  /**
   * Clean up the mutation observer when the controller is destroyed
   */
  public cleanup(): void {
    if (this.collectionObserver) {
      this.collectionObserver.disconnect();
      this.collectionObserver = null;
    }
    if (this.globalObserver) {
      this.globalObserver.disconnect();
      this.globalObserver = null;
    }
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
    }
  }

  /**
   * Setup periodic checking for new collection items as final failsafe
   */
  private setupPeriodicItemCheck(): void {
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
    }

    let previousItemCount = BandcampFacade.loadWishlistItems().length;
    Logger.info(`Setting up periodic item check (initial count: ${previousItemCount})`);
    
    this.periodicCheckInterval = window.setInterval(() => {
      // Only check if we're still on a collection page
      if (!BandcampFacade.isCollectionPage) {
        return;
      }
      
      const currentItems = BandcampFacade.loadWishlistItems();
      const currentItemCount = currentItems.length;
      
      if (currentItemCount > previousItemCount) {
        Logger.info(`Periodic check detected ${currentItemCount - previousItemCount} new items (${previousItemCount} → ${currentItemCount})`);
        
        // Update shuffle order if shuffle mode is enabled
        Logger.info(`Periodic check - shuffle mode: enabled=${ShuffleService.isShuffleEnabled}`);
        if (ShuffleService.isShuffleEnabled) {
          Logger.info(`Shuffle mode enabled, updating shuffle order for new collection items (periodic check)`);
          ShuffleService.updateShuffleOrderForNewItems('collection', currentItemCount, BandcampFacade.currentWishlistIndex >= 0 ? BandcampFacade.currentWishlistIndex : 0);
        } else {
          Logger.info(`Shuffle mode not enabled, skipping shuffle order update (periodic check)`);
        }
        
        previousItemCount = currentItemCount;
      }
    }, 5000); // Check every 5 seconds
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
