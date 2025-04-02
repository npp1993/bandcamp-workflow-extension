import {BandcampFacade} from '../facades/bandcamp.facade';
import {TrackController} from './track.controller';
import {Controllers} from './page.controller';

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
    
    console.log('Keyboard controller started with direct event handling');
  }
  
  /**
   * Main keyboard event handler
   */
  private static handleKeyboardEvent = (e: KeyboardEvent): void => {
    // Only log in debug mode - log once at the entry point
    if (!["INPUT", "TEXTAREA", "SELECT"].includes((e.target as Element).tagName) && 
        !(e.target as HTMLElement).isContentEditable) {
      // Create a more condensed log format with key info
      const modifiers = 
        (e.shiftKey ? 'Shift+' : '') + 
        (e.ctrlKey ? 'Ctrl+' : '') + 
        (e.altKey ? 'Alt+' : '') + 
        (e.metaKey ? 'Meta+' : '');
      
      console.log(`Key: ${modifiers}${e.key.toLowerCase()} (${e.code})`);
      
      // Handle our specific shortcut keys
      switch (e.key.toLowerCase()) {
        case 'q':
          e.preventDefault();
          BandcampFacade.toggleWishlist();
          break;
          
        case 'w':
          e.preventDefault();
          this.toggleWishlistTrack();
          break;
          
        case 'c':
          e.preventDefault();
          BandcampFacade.buyCurrentTrack();
          break;
          
        case 'i':
          e.preventDefault();
          BandcampFacade.seekReset();
          break;
          
        case ' ':
          e.preventDefault();
          BandcampFacade.togglePlayPause();
          break;
          
        case 'p':
          // Check for shift modifier for first track functionality
          e.preventDefault();
          if (e.shiftKey) {
            BandcampFacade.playFirstTrack();
          } else {
            this.handlePreviousTrack();
          }
          break;
          
        case 'n':
          e.preventDefault();
          this.handleNextTrack();
          break;
          
        case 'a':
          // Load all items in wishlist page
          e.preventDefault();
          if (BandcampFacade.isWishlistPage) {
            this.loadAllWishlistItems();
          }
          break;
          
        case 'h':
        case 'arrowleft':
          e.preventDefault();
          BandcampFacade.seekBackward();
          break;
          
        case 'l':
        case 'arrowright':
          e.preventDefault();
          BandcampFacade.seekForward();
          break;
          
        case 'arrowup':
          e.preventDefault();
          if (this.controllers && this.controllers.speed) {
            this.controllers.speed.increase();
          }
          break;
          
        case 'arrowdown':
          e.preventDefault();
          if (this.controllers && this.controllers.speed) {
            this.controllers.speed.decrease();
          }
          break;
          
        case 'r':
          // e.preventDefault();
          if (this.controllers && this.controllers.speed) {
            this.controllers.speed.reset();
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
      BandcampFacade.playPreviousWishlistTrack();
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
  
  /**
   * Load all wishlist items by clicking the "view all items" button
   */
  private static loadAllWishlistItems() {
    BandcampFacade.loadAllWishlistItems()
      .then(success => {
        if (success) {
          console.log('Successfully loaded all wishlist items');
        } else {
          console.warn('Failed to load all wishlist items');
        }
      })
      .catch(error => {
        console.error('Error loading all wishlist items:', error);
      });
  }
}
