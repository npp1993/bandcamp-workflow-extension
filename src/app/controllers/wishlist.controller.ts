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
          this.hasInitialized = true;
        }
      } catch (error) {
        Logger.error('Error initializing wishlist controller:', error);
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
        
        // Initialize collection-specific functionality
        if (BandcampFacade.isCollectionPage) {
          // Set up observer to watch for new collection items being loaded
          this.setupCollectionItemObserver();
          // Also set up a global observer as backup
          this.setupGlobalCollectionObserver();
          // Set up periodic checking as final failsafe
          this.setupPeriodicItemCheck();
        }
        
        // Processing complete
      } else {
        const pageType = BandcampFacade.isWishlistPage ? 'wishlist' : 'collection';
        Logger.warn(`No ${pageType} items found during initialization`);
      }
      
      this.hasInitialized = true;
    } catch (error) {
      Logger.error('Error in initializeItemsAndControls:', error);
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

    Logger.debug('Setting up collection item observer on container:', collectionContainer.className);
    Logger.debug('Container element details:', {
      id: collectionContainer.id,
      className: collectionContainer.className,
      tagName: collectionContainer.tagName,
      childElementCount: collectionContainer.childElementCount
    });

    let previousItemCount = BandcampFacade.loadWishlistItems().length;
    Logger.debug(`Initial item count for observer: ${previousItemCount}`);
    
    this.collectionObserver = new MutationObserver((mutations) => {
      Logger.debug(`Collection observer triggered with ${mutations.length} mutations`);
      
      // Log all mutations for debugging
      mutations.forEach((mutation, index) => {
        Logger.debug(`Mutation ${index + 1}:`, {
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
              Logger.debug(`Added node ${i + 1}:`, {
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
                Logger.debug('Detected new collection item:', element.className);
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
        
        Logger.debug(`Item count check: ${previousItemCount} → ${currentItemCount} (hasNewItems: ${hasNewItems})`);
        
        if (currentItemCount > previousItemCount) {
          Logger.debug(`Collection observer detected ${currentItemCount - previousItemCount} new items (${previousItemCount} → ${currentItemCount})`);
          
          // Update shuffle order if shuffle mode is enabled
          if (ShuffleService.isShuffleEnabled) {
            Logger.debug(`Shuffle mode enabled, updating shuffle order for new collection items`);
            ShuffleService.updateShuffleOrderForNewItems('collection', currentItemCount, BandcampFacade.currentWishlistIndex >= 0 ? BandcampFacade.currentWishlistIndex : 0);
          }
          
          previousItemCount = currentItemCount;
        } else if (currentItemCount !== previousItemCount) {
          Logger.debug(`Item count changed unexpectedly: ${previousItemCount} → ${currentItemCount}`);
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
    
    Logger.debug('Collection mutation observer is now active');
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
    
    Logger.debug('Setting up global collection observer as backup');
    
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
            Logger.debug('Global observer detected collection-related DOM changes');
            break;
          }
        }
      }
      
      if (hasCollectionRelatedChanges) {
        setTimeout(() => {
          const currentItems = BandcampFacade.loadWishlistItems();
          const currentItemCount = currentItems.length;
             if (currentItemCount > previousItemCount) {
          Logger.debug(`Global observer detected ${currentItemCount - previousItemCount} new items (${previousItemCount} → ${currentItemCount})`);
          
          // Update shuffle order if shuffle mode is enabled
          Logger.debug(`Checking shuffle mode: enabled=${ShuffleService.isShuffleEnabled}`);
          if (ShuffleService.isShuffleEnabled) {
            Logger.debug(`Shuffle mode enabled, updating shuffle order for new collection items (global observer)`);
            ShuffleService.updateShuffleOrderForNewItems('collection', currentItemCount, BandcampFacade.currentWishlistIndex >= 0 ? BandcampFacade.currentWishlistIndex : 0);
          } else {
            Logger.debug(`Shuffle mode not enabled, skipping shuffle order update`);
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
    Logger.debug(`Setting up periodic item check (initial count: ${previousItemCount})`);
    
    this.periodicCheckInterval = window.setInterval(() => {
      // Only check if we're still on a collection page
      if (!BandcampFacade.isCollectionPage) {
        return;
      }
      
      const currentItems = BandcampFacade.loadWishlistItems();
      const currentItemCount = currentItems.length;
      
      if (currentItemCount > previousItemCount) {
        Logger.debug(`Periodic check detected ${currentItemCount - previousItemCount} new items (${previousItemCount} → ${currentItemCount})`);
        
        // Update shuffle order if shuffle mode is enabled
        Logger.debug(`Periodic check - shuffle mode: enabled=${ShuffleService.isShuffleEnabled}`);
        if (ShuffleService.isShuffleEnabled) {
          Logger.debug(`Shuffle mode enabled, updating shuffle order for new collection items (periodic check)`);
          ShuffleService.updateShuffleOrderForNewItems('collection', currentItemCount, BandcampFacade.currentWishlistIndex >= 0 ? BandcampFacade.currentWishlistIndex : 0);
        } else {
          Logger.debug(`Shuffle mode not enabled, skipping shuffle order update (periodic check)`);
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
      case 'b':
        event.preventDefault();
        BulkCartService.exitBulkMode();
        return true;
      case 'c':
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
