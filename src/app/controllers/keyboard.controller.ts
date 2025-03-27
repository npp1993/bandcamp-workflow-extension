import {BandcampFacade} from '../facades/bandcamp.facade';
import {TrackController} from './track.controller';
import {Controllers} from './page.controller';

enum Keys {
  Space = ' ',
  C = 'C',
  I = 'I',
  N = 'N',
  P = 'P',
  Q = 'Q',
  R = 'R',
  W = 'W',
  H = 'H',
  L = 'L',
  ArrowLeft = 'ARROWLEFT',
  ArrowRight = 'ARROWRIGHT',
  ArrowUp = 'ARROWUP',
  ArrowDown = 'ARROWDOWN',
}

export class KeyboardController {
  private static events: Record<Keys, () => void>;

  private static eventsPreventing: Partial<Record<Keys, boolean>>;

  private static eventsWithShift: Partial<Record<Keys, () => void>>;

  private static controllers: Controllers;

  private static currentTrack: TrackController;

  public static setCurrentTrack(track: TrackController): void {
    this.currentTrack = track;
  }

  public static start(controllers: Controllers): void {
    this.controllers = controllers;
    this.setEvents();
    this.setEventsWithShift();
    this.setEventsPreventing();
    
    // Clear any existing event listeners (in case there are duplicates)
    document.removeEventListener('keydown', this.handleKeyboardEvent);
    
    // Attach our new, simpler keyboard handler directly to the document
    document.addEventListener('keydown', this.handleKeyboardEvent);
    
    console.log('Keyboard controller started with new direct event handling');
  }
  
  // New direct event handler as a static property for easy binding/unbinding
  private static handleKeyboardEvent = (e: KeyboardEvent): void => {
    console.log(`Key pressed: "${e.key}" (code: ${e.code})`);
    
    // First, check if we're in an input field or similar
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
        
      // Add other key handlers as needed
    }
  }

  private static setEventsPreventing() {
    this.eventsPreventing = {
      [Keys.Space]: true,
      [Keys.H]: true,
      [Keys.I]: true,
      [Keys.L]: true,
      [Keys.Q]: true,
      [Keys.ArrowLeft]: true,
      [Keys.ArrowRight]: true,
      [Keys.ArrowUp]: true,
      [Keys.ArrowDown]: true,
    };
  }

  private static setEventsWithShift() {
    this.eventsWithShift = {
      [Keys.P]: () => BandcampFacade.playFirstTrack(),
      [Keys.R]: () => this.controllers.speed.reset(),
    };
  }

  private static setEvents() {
    this.events = {
      [Keys.C]: () => this.controllers.copyInfo.handleClick(),
      [Keys.Space]: () => BandcampFacade.togglePlayPause(),
      [Keys.P]: () => this.handlePreviousTrack(),
      [Keys.N]: () => this.handleNextTrack(),
      [Keys.Q]: () => this.toggleWishlistRelease(), // Add entire release to wishlist
      [Keys.R]: () => this.controllers.speed.reset(),
      [Keys.W]: () => this.toggleWishlistTrack(), // Toggle wishlist for current track
      [Keys.I]: () => BandcampFacade.seekReset(),
      [Keys.L]: () => BandcampFacade.seekForward(),
      [Keys.H]: () => BandcampFacade.seekBackward(),
      [Keys.ArrowLeft]: () => BandcampFacade.seekBackward(),
      [Keys.ArrowRight]: () => BandcampFacade.seekForward(),
      [Keys.ArrowUp]: () => this.controllers.speed.increase(),
      [Keys.ArrowDown]: () => this.controllers.speed.decrease(),
    };
  }

  private static toggleWishlistRelease() {
    BandcampFacade.toggleWishlist();
  }

  private static toggleWishlistTrack() {
    // If we're on the wishlist page, toggle the current track in the player
    if (BandcampFacade.isWishlistPage) {
      BandcampFacade.toggleCurrentTrackWishlist();
      return;
    }
    
    // If we're on a track page, toggle the entire track
    if (BandcampFacade.isTrack) {
      this.toggleWishlistRelease();
      return;
    }

    // If we're on an album page with a specific track selected
    if (BandcampFacade.isAlbum && this.currentTrack) {
      this.currentTrack.click();
    }
  }

  private static isBody(target: EventTarget): boolean {
    return target instanceof Element && target.tagName.toUpperCase() === 'BODY';
  }

  private static handleKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!(this.isBody(e.target))) {
        return;
      }

      // Get the key and normalize it to uppercase for consistency
      const key = e.key.toUpperCase() as Keys;
      const {shiftKey, ctrlKey, metaKey, altKey} = e;

      // Add debug logging to help diagnose issues
      console.log(`Key pressed: ${key}, keyCode: ${e.keyCode}`);

      // Check if this key is in our events map
      if (Object.keys(this.events).indexOf(key) === -1) {
        console.log(`Key ${key} not found in events map`);
        return;
      }

      // handle events with shift
      if (shiftKey && this.eventsWithShift[key]) {
        console.log(`Executing shift + ${key} action`);
        this.eventsWithShift[key]();
        return;
      }

      // handle events with no modifier
      if (this.events[key] && (!shiftKey && !ctrlKey && !metaKey && !altKey)) {
        if (this.eventsPreventing[key]) {
          e.preventDefault();
        }

        console.log(`Executing ${key} action`);
        this.events[key]();
      }
    });
  }

  private static handlePreviousTrack() {
    if (BandcampFacade.isWishlistPage) {
      BandcampFacade.playPreviousWishlistTrack();
    } else {
      BandcampFacade.getPrevious().click();
    }
  }

  private static handleNextTrack() {
    if (BandcampFacade.isWishlistPage) {
      BandcampFacade.playNextWishlistTrack();
    } else {
      BandcampFacade.getNext().click();
    }
  }
}
