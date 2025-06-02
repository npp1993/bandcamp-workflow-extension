import {BandcampFacade} from '../facades/bandcamp.facade';
import {TrackController} from './track.controller';
import {Controllers} from './page.controller';
import {Logger} from '../utils/logger';

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
    
    // Attach our keyboard handler directly to the document
    document.addEventListener('keydown', this.handleKeyboardEvent);
    
    Logger.info('Keyboard controller started with direct event handling');
  }
  
  /**
   * Main keyboard event handler
   */
  private static handleKeyboardEvent = (e: KeyboardEvent): void => {
    // Only process keyboard events when not in input fields
    if (!["INPUT", "TEXTAREA", "SELECT"].includes((e.target as Element).tagName) && 
        !(e.target as HTMLElement).isContentEditable) {
      
      // Handle our specific shortcut keys
      switch (e.key.toLowerCase()) {
        case 'q':
          // Only trigger wishlist toggle if no modifier keys are pressed
          // This allows Command+Q (quit), Ctrl+Q, etc. to work normally
          // Only works on album/release pages, not on track or wishlist pages
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            if (BandcampFacade.isAlbum) {
              Logger.debug('Extension shortcut: q (toggle wishlist on album page)');
              e.preventDefault();
              BandcampFacade.toggleWishlist();
            } else {
              Logger.debug('q key pressed but not on album page - ignoring');
            }
          }
          break;
          
        case 'w':
          // Only trigger wishlist track toggle if no modifier keys are pressed
          // This allows Command+W (close tab), Ctrl+W, etc. to work normally
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            Logger.debug('Extension shortcut: w (toggle wishlist track)');
            e.preventDefault();
            this.toggleWishlistTrack();
          }
          break;
          
        case 'c':
          // Only trigger add to cart functionality if no modifier keys are pressed
          // This allows Command+C (copy), Ctrl+C (copy), etc. to work normally
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            Logger.debug('Extension shortcut: c (add current track to cart)');
            e.preventDefault();
            BandcampFacade.addCurrentTrackToCart();
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
          // Check for shift modifier for first track functionality
          // Only trigger if no Command/Ctrl keys are pressed (allow Command+P for print)
          if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            if (e.shiftKey) {
              BandcampFacade.playFirstTrack();
            } else {
              this.handlePreviousTrack();
            }
          }
          break;
          
        case 'n':
          // Only trigger next track if no modifier keys are pressed
          // This allows Command+N (new window), Ctrl+N, etc. to work normally
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
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
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            if (this.controllers && this.controllers.speed) {
              this.controllers.speed.increase();
            }
          }
          break;
          
        case 'arrowdown':
          // Only trigger speed decrease if no modifier keys are pressed
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            if (this.controllers && this.controllers.speed) {
              this.controllers.speed.decrease();
            }
          }
          break;
          
        case 'r':
          // Only trigger speed reset if no modifier keys are pressed
          // This allows Cmd+R (reload page), Ctrl+R, etc. to work normally
          if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
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
    if (BandcampFacade.isWishlistPage) {
      // Handle async call without blocking
      BandcampFacade.playPreviousWishlistTrack().catch(error => {
        Logger.error('Error in playPreviousWishlistTrack:', error);
      });
    } else {
      BandcampFacade.getPrevious().click();
    }
  }

  /**
   * Handle playing the next track
   */
  private static handleNextTrack() {
    if (BandcampFacade.isWishlistPage) {
      BandcampFacade.playNextWishlistTrack();
    } else {
      BandcampFacade.getNext().click();
    }
  }
}
