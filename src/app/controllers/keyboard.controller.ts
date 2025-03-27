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
    console.log(`Key pressed: "${e.key}" (code: ${e.code})`);
    
    // Ignore keyboard shortcuts when typing in input fields
    const target = e.target as Element;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || 
        (target as HTMLElement).isContentEditable) {
      console.log('Ignoring key press in input element');
      return;
    }
    
    // Handle our specific shortcut keys
    switch (e.key.toLowerCase()) {
      case 'q':
        console.log('Q key detected - toggling wishlist for entire release');
        e.preventDefault();
        BandcampFacade.toggleWishlist();
        break;
        
      case 'w':
        console.log('W key detected - toggling wishlist for current track');
        e.preventDefault();
        this.toggleWishlistTrack();
        break;
        
      case 'i':
        console.log('I key detected - seeking to start of track');
        e.preventDefault();
        BandcampFacade.seekReset();
        break;
        
      case ' ':
        console.log('Space key detected - toggling play/pause');
        e.preventDefault();
        BandcampFacade.togglePlayPause();
        break;
        
      case 'c':
        console.log('C key detected - copying track info');
        if (this.controllers && this.controllers.copyInfo) {
          this.controllers.copyInfo.handleClick();
        }
        break;
        
      case 'p':
        // Check for shift modifier for first track functionality
        if (e.shiftKey) {
          console.log('Shift+P detected - playing first track');
          BandcampFacade.playFirstTrack();
        } else {
          console.log('P key detected - playing previous track');
          this.handlePreviousTrack();
        }
        e.preventDefault();
        break;
        
      case 'n':
        console.log('N key detected - playing next track');
        e.preventDefault();
        this.handleNextTrack();
        break;
        
      case 'h':
        console.log('H key detected - seeking backward');
        e.preventDefault();
        BandcampFacade.seekBackward();
        break;
        
      case 'l':
        console.log('L key detected - seeking forward');
        e.preventDefault();
        BandcampFacade.seekForward();
        break;
        
      case 'arrowleft':
        console.log('ArrowLeft key detected - seeking backward');
        e.preventDefault();
        BandcampFacade.seekBackward();
        break;
        
      case 'arrowright':
        console.log('ArrowRight key detected - seeking forward');
        e.preventDefault();
        BandcampFacade.seekForward();
        break;
        
      case 'arrowup':
        console.log('ArrowUp key detected - increasing speed');
        e.preventDefault();
        if (this.controllers && this.controllers.speed) {
          this.controllers.speed.increase();
        }
        break;
        
      case 'arrowdown':
        console.log('ArrowDown key detected - decreasing speed');
        e.preventDefault();
        if (this.controllers && this.controllers.speed) {
          this.controllers.speed.decrease();
        }
        break;
        
      case 'r':
        // Check for shift modifier
        if (e.shiftKey) {
          console.log('Shift+R detected - resetting playback speed');
          if (this.controllers && this.controllers.speed) {
            this.controllers.speed.reset();
          }
        }
        break;
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
}
