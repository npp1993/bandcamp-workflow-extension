import {BandcampFacade} from '../facades/bandcamp.facade';
import {TrackController} from './track.controller';
import {WishlistController} from './wishlist.controller';
import {Controllers} from './page.controller';
import {Logger} from '../utils/logger';
import {BulkCartService} from '../services/bulk-cart.service';
import {ShuffleService} from '../services/shuffle.service';
import {KeyboardSidebarController} from './keyboard-sidebar.controller';

/**
 * KeyboardController class handles keyboard shortcuts for the extension
 */
export class KeyboardController {
  private static controllers: Controllers;

  private static currentTrack: TrackController;

  public static setCurrentTrack(track: TrackController): void {
    this.currentTrack = track;
  }

  public static start(controllers: Controllers): void {
    this.controllers = controllers;
    
    // Clear any existing event listeners (in case there are duplicates)
    document.removeEventListener('keydown', this.handleKeyboardEvent);
    document.removeEventListener('keyup', this.handleKeyUpEvent);
    
    // Attach our keyboard handlers directly to the document
    document.addEventListener('keydown', this.handleKeyboardEvent);
    document.addEventListener('keyup', this.handleKeyUpEvent);
  }
  
  /**
   * Main keyboard event handler
   */
  private static handleKeyboardEvent = (e: KeyboardEvent): void => {
    // Only process keyboard events when not in input fields
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as Element).tagName) && 
        !(e.target as HTMLElement).isContentEditable) {
      
      // First check if we're in bulk mode and handle bulk mode navigation
      if (BulkCartService.isInBulkMode) {
        const handled = WishlistController.handleBulkModeKeyboard(e);
        if (handled) {
          return;
        }
      }
      
      // Handle our specific shortcut keys
      switch (e.key.toLowerCase()) {
        case 'b':
          // Only trigger bulk mode if no modifier keys are pressed and we're on wishlist page
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            if (BandcampFacade.isWishlistPage) {
              e.preventDefault();
              this.handleBulkMode();
            }
          }
          break;
          
        case 'q':
          // Only trigger wishlist toggle if no modifier keys are pressed
          // This allows Command+Q (quit), Ctrl+Q, etc. to work normally
          // Only works on album/release pages, not on track or wishlist pages
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            if (BandcampFacade.isAlbum) {
              e.preventDefault();
              BandcampFacade.toggleWishlist();
            }
          }
          break;
          
        case 'w':
          // Only trigger wishlist track toggle if no modifier keys are pressed
          // This allows Command+W (close tab), Ctrl+W, etc. to work normally
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            this.toggleWishlistTrack();
          }
          break;

        case 's':
          // Only trigger shuffle toggle on collection-based pages if no modifier keys are pressed
          // This allows Ctrl+S (save), Command+S, etc. to work normally
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && BandcampFacade.isCollectionBasedPage) {
            e.preventDefault();
            ShuffleService.toggleShuffle();
            // Refresh sidebar UI immediately
            KeyboardSidebarController.refreshUI();
          }
          break;
          
        case 'c':
          // Handle add to cart functionality with special handling for Shift+C
          // Disabled on collection pages
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !BandcampFacade.isCollectionPage) {
            e.preventDefault();
            
            // Check if we're in bulk mode first
            if (BulkCartService.isInBulkMode) {
              // In bulk mode, both C and Shift+C should add selected items to cart
              if (!BulkCartService.isProcessing) {
                BulkCartService.processSelectedItems();
              }
            } else {
              // Regular mode: handle C and Shift+C normally
              if (e.shiftKey) {
                // Shift+C: Add to cart and close tab (wishlist and track pages only)
                if (BandcampFacade.isWishlistPage) {
                  BandcampFacade.addCurrentTrackToCart(true); // closeTabAfterAdd = true
                } else if (BandcampFacade.isTrack) {
                  BandcampFacade.addCurrentTrackToCart(true); // closeTabAfterAdd = true
                } else {
                  // On other pages, Shift+C behaves the same as C
                  BandcampFacade.addCurrentTrackToCart();
                }
              } else {
                // Regular C: Add to cart without closing tab (wishlist and track pages only)
                // On album pages, 'c' only works if a track is selected
                BandcampFacade.addCurrentTrackToCart();
              }
            }
          }
          break;
          
        case 'z':
          // Add current album to cart (album pages only)
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && BandcampFacade.isAlbum) {
            e.preventDefault();
            BandcampFacade.addCurrentAlbumToCart();
          }
          break;
          
        case 'i':
          // Only trigger seek reset if no modifier keys are pressed
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            BandcampFacade.seekReset();
          }
          break;
          
        case ' ':
          // Only trigger play/pause if no modifier keys are pressed
          // This allows Shift+Space for scrolling up, etc.
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            BandcampFacade.togglePlayPause();
          }
          break;
          
        case 'p':
          // Only trigger previous track if no Command/Ctrl keys are pressed (allow Command+P for print)
          // Skip if in bulk mode (bulk mode handles 'p' for navigation)
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !BulkCartService.isInBulkMode) {
            e.preventDefault();
            this.handlePreviousTrack();
          }
          break;
          
        case 'n':
          // Only trigger next track if no modifier keys are pressed
          // This allows Command+N (new window), Ctrl+N, etc. to work normally
          // Skip if in bulk mode (bulk mode handles 'n' for navigation)
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !BulkCartService.isInBulkMode) {
            e.preventDefault();
            this.handleNextTrack();
          }
          break;
          
        case 'h':
        case 'arrowleft':
          // Only trigger seek backward if no modifier keys are pressed
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            BandcampFacade.seekBackward();
          }
          break;
          
        case 'l':
        case 'arrowright':
          // Only trigger seek forward if no modifier keys are pressed
          // This allows Cmd+L (address bar), Ctrl+L, etc. to work normally
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            BandcampFacade.seekForward();
          }
          break;
          
        case 'arrowup':
          // Only trigger speed increase if no modifier keys are pressed
          // Disabled on wishlist and collection pages
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !BandcampFacade.isCollectionBasedPage) {
            e.preventDefault();
            if (this.controllers && this.controllers.speed) {
              this.controllers.speed.increase();
            }
          }
          break;
          
        case 'arrowdown':
          // Only trigger speed decrease if no modifier keys are pressed
          // Disabled on wishlist and collection pages
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !BandcampFacade.isCollectionBasedPage) {
            e.preventDefault();
            if (this.controllers && this.controllers.speed) {
              this.controllers.speed.decrease();
            }
          }
          break;
          
        case 'r':
          // Only trigger speed reset if no modifier keys are pressed
          // This allows Cmd+R (reload page), Ctrl+R, etc. to work normally
          // Disabled on wishlist and collection pages
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !BandcampFacade.isCollectionBasedPage) {
            // Don't prevent default for 'r' to allow page reload
            if (this.controllers && this.controllers.speed) {
              this.controllers.speed.reset();
            }
          }
          break;
      }
    }
  }

  /**
   * Main keyboard keyup event handler
   */
  private static handleKeyUpEvent = (e: KeyboardEvent): void => {
    // Only process keyboard events when not in input fields
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as Element).tagName) && 
        !(e.target as HTMLElement).isContentEditable) {
      
      // Handle bulk mode keyup events (specifically for F key release)
      if (BulkCartService.isInBulkMode) {
        WishlistController.handleBulkModeKeyUp(e);
      }
    }
  }

  /**
   * Helper method to toggle wishlist status for the current track
   */
  private static toggleWishlistTrack() {
    // If we're on the wishlist page, toggle the current track in the player
    if (BandcampFacade.isWishlistPage) {
      BandcampFacade.toggleCurrentTrackWishlist();
      return;
    }
    
    // If we're on a track page, toggle the entire track
    if (BandcampFacade.isTrack) {
      BandcampFacade.toggleWishlist();
      return;
    }

    // If we're on an album page with a specific track selected
    if (BandcampFacade.isAlbum && this.currentTrack) {
      this.currentTrack.click();
    }
  }

  /**
   * Handle playing the previous track
   */
  private static handlePreviousTrack() {
    if (BandcampFacade.isCollectionBasedPage) {
      // Handle async call without blocking
      BandcampFacade.playPreviousWishlistTrack()
        .catch((error: any) => {
          Logger.error('Error in playPreviousWishlistTrack:', error);
        });
    } else {
      // Use optimized release page navigation with Phase 2 improvements
      BandcampFacade.playPreviousReleaseTrack();
    }
  }

  /**
   * Handle playing the next track
   */
  private static handleNextTrack() {
    if (BandcampFacade.isCollectionBasedPage) {
      BandcampFacade.playNextWishlistTrack();
    } else {
      // Use optimized release page navigation with Phase 2 improvements
      BandcampFacade.playNextReleaseTrack();
    }
  }

  /**
   * Handle bulk mode toggle
   */
  private static handleBulkMode() {
    if (BulkCartService.isInBulkMode) {
      if (!BulkCartService.isProcessing) {
        // Start processing selected items
        BulkCartService.processSelectedItems();
      }
    } else {
      // Enter bulk mode
      const wishlistItems = BandcampFacade.loadWishlistItems();
      if (wishlistItems.length > 0) {
        BulkCartService.enterBulkMode(wishlistItems);
      } else {
        Logger.warn('No wishlist items found for bulk cart mode');
      }
    }
    // Refresh sidebar UI immediately
    KeyboardSidebarController.refreshUI();
  }
}
