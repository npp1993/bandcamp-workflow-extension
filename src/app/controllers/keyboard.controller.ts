import {BandcampFacade} from '../facades/bandcamp.facade';
import {TrackController} from './track.controller';
import {Controllers} from './page.controller';

enum Keys {
  Space = ' ',
  C = 'C',
  J = 'J',
  H = 'H',
  K = 'K',
  L = 'L',
  N = 'N',
  P = 'P',
  R = 'R',
  W = 'W',
  ArrowLeft = 'ARROWLEFT',
  ArrowRight = 'ARROWRIGHT',
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
    this.handleKeyboard();
  }

  private static setEventsPreventing() {
    this.eventsPreventing = {
      [Keys.Space]: true,
      [Keys.H]: true,
      [Keys.L]: true,
      [Keys.J]: true,
      [Keys.K]: true,
      [Keys.ArrowLeft]: true,
      [Keys.ArrowRight]: true,
    };
  }

  private static setEventsWithShift() {
    this.eventsWithShift = {
      [Keys.P]: () => BandcampFacade.playFirstTrack(),
      [Keys.W]: () => this.toggleWishlistRelease(),
      [Keys.R]: () => this.controllers.speed.reset(),
      [Keys.H]: () => BandcampFacade.seekReset(),
      [Keys.K]: () => this.controllers.speed.increase(),
      [Keys.J]: () => this.controllers.speed.decrease(),
    };
  }

  private static setEvents() {
    this.events = {
      [Keys.C]: () => this.controllers.copyInfo.handleClick(),
      [Keys.Space]: () => BandcampFacade.getPlay().click(),
      [Keys.P]: () => this.handlePreviousTrack(),
      [Keys.N]: () => this.handleNextTrack(),
      [Keys.R]: () => this.controllers.volume.reset(),
      [Keys.W]: () => this.toggleWishlistTrack(),
      [Keys.L]: () => BandcampFacade.seekForward(),
      [Keys.H]: () => BandcampFacade.seekBackward(),
      [Keys.K]: () => this.controllers.volume.increase(),
      [Keys.J]: () => this.controllers.volume.decrease(),
      [Keys.ArrowLeft]: () => this.handlePreviousTrack(),
      [Keys.ArrowRight]: () => this.handleNextTrack(),
    };
  }

  private static toggleWishlistRelease() {
    BandcampFacade.toggleWishlist();
  }

  private static toggleWishlistTrack() {
    // fallback if current page is a track
    if (BandcampFacade.isTrack) {
      this.toggleWishlistRelease();
      return;
    }

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

      const key = e.key.toUpperCase() as Keys;
      const {shiftKey, ctrlKey, metaKey, altKey} = e;

      // ignore if key is not in events
      if (Object.keys(this.events).indexOf(key) === -1) {
        return;
      }

      // handle events with shift
      if (shiftKey && this.eventsWithShift[key]) {
        this.eventsWithShift[key]();
        return;
      }

      // handle events with no modifier
      if (this.events[key] && (!shiftKey && !ctrlKey && !metaKey && !altKey)) {
        if (this.eventsPreventing[key]) {
          e.preventDefault();
        }

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
