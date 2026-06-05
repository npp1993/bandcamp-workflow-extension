import {SPEED_GRID_CLASS, TIMEOUT, WAVEFORM_ELEMENT_SELECTOR} from '../constants';
import {Logger} from '../utils/logger';
import {PageDetection} from './bandcamp/page-detection';
import {ReleaseNavigation} from './bandcamp/release-navigation';
import {WishlistPlayback} from './bandcamp/wishlist-playback';
import {Transport} from './bandcamp/transport';
import {TrackActions} from './bandcamp/track-actions';
import {AudioUtils} from '../utils/audio-utils';
import {SeekUtils} from '../utils/seek-utils';
import {ShuffleService} from '../services/shuffle.service';

// Add type definition for window.TralbumData
declare global {
  interface Window {
    TralbumData: any;
  }
}

export interface BandcampColors {
  bg_color: string;
  body_color: string;
  hd_ft_color: string;
  link_color: string;
  navbar_bg_color: string;
  secondary_text_color: string;
  text_color: string;
}

export interface BandcampData {
  fan_tralbum_data: {
    band_id: number;
    fan_id: number;
    is_wishlisted: boolean;
  };
}

export enum BandcampWishlistState {
  NotLiked = 'wishlist',
  Liked = 'wishlisted',
}

/**
 * Class to handle the BandcampFacade module.
 */
export class BandcampFacade {
  private static _data?: BandcampData;

  private static _colors?: BandcampColors;

  private static _audio?: HTMLAudioElement;

  // Internal playback/navigation state shared with the bandcamp/* modules (intentionally not private).
  static _wishlistItems: HTMLElement[] = [];

  static _currentWishlistIndex = -1;

  static _pendingNextTrackRequest = false;

  static _errorRecoveryInProgress = false;

  static _skipInProgress = false;

  static _consecutiveErrors = 0;

  static _maxConsecutiveErrors = 3;

  private static _errorLogSuppressed = false;

  static _releaseNavigationInProgress = false;
  
  // Flag to track when we're doing programmatic navigation (vs manual user clicks)
  static _programmaticNavigationInProgress = false;

  // Static list to keep track of problematic track IDs that return 404s
  static _problemTrackIds: Set<string> = new Set();

  public static get data(): BandcampData | null {
    if (this._data) {
      return this._data;
    }

    const pageData = document.getElementById('pagedata');
    if (!pageData) {
      return null;
    }

    const dataBlob = pageData.getAttribute('data-blob');
    if (!dataBlob) {
      return null;
    }
    const data = JSON.parse(dataBlob) as BandcampData;
    this._data = data;

    return data;
  }

  public static get isTrack(): boolean {
    return PageDetection.isTrack;
  }

  public static get isAlbum(): boolean {
    return PageDetection.isAlbum;
  }

  public static get isWishlistPage(): boolean {
    return PageDetection.isWishlistPage;
  }

  public static get isCollectionPage(): boolean {
    return PageDetection.isCollectionPage;
  }

  public static get isFollowersPage(): boolean {
    return PageDetection.isFollowersPage;
  }

  public static get isFollowingPage(): boolean {
    return PageDetection.isFollowingPage;
  }

  /**
   * Check if current page supports track transport controls (wishlist or collection)
   */
  public static get isCollectionBasedPage(): boolean {
    return PageDetection.isCollectionBasedPage;
  }

  /**
   * Get the current wishlist item index for debugging purposes
   */
  public static get currentWishlistIndex(): number {
    return this._currentWishlistIndex;
  }

  public static get colors(): BandcampColors | undefined {
    if (this._colors) {
      return this._colors;
    }

    const node = document.getElementById('custom-design-rules-style');

    if (!node) {
      setTimeout(() => this.colors, TIMEOUT);
      return undefined;
    }

    const design = node.getAttribute('data-design');
    if (design) {
      this._colors = JSON.parse(design);
    }

    return this._colors;
  }

  public static get audio(): HTMLAudioElement {
    if (this._audio) {
      return this._audio;
    }

    this._audio = document.getElementsByTagName('audio')[0];

    return this._audio;
  }

  public static get isPageSupported(): boolean {
    return PageDetection.isPageSupported;
  }

  public static get isLoggedIn(): boolean {
    return PageDetection.isLoggedIn;
  }

  public static get currentTrackContainer(): HTMLSpanElement {
    return document.querySelector('#trackInfo span.title') as HTMLSpanElement;
  }

  public static get trackTable(): HTMLTableElement | null {
    return document.getElementById('track_table') as HTMLTableElement;
  }

  public static get tracks(): HTMLTableRowElement[] {
    const table = this.trackTable;
    if (!table) {
      return [];
    }
    const tracks = table.querySelectorAll('.track_row_view');
    return Array.from(tracks as NodeListOf<HTMLTableRowElement>);
  }

  public static get player(): HTMLDivElement {
    return document.getElementsByClassName(
      'inline_player',
    )[0] as HTMLDivElement;
  }

  public static get wishlistButton(): HTMLLIElement {
    return document.getElementById('collect-item') as HTMLLIElement;
  }

  public static getTrackInfo(): string {
    let payload = '';

    const artist = document.getElementById('name-section')!.children[1]
      .children[0] as HTMLSpanElement;
    payload += artist.innerText;

    if (this.isTrack) {
      const trackTitle = document.getElementsByClassName(
        'trackTitle',
      )[0] as HTMLTitleElement;
      payload += ` ${trackTitle.innerText}`;
    } else if (this.isAlbum) {
      const albumTitle = document.getElementsByClassName(
        'title-section',
      )[0] as HTMLSpanElement;
      payload += ` ${albumTitle.innerText}`;
    }

    return payload.trim();
  }

  public static arrange(): void {
    this.movePlaylist();
    this.rectifyMargins();
  }

  public static getPlay(): HTMLDivElement {
    return document.getElementsByClassName('playbutton')[0] as HTMLDivElement;
  }

  public static getPrevious(): HTMLDivElement {
    return document.getElementsByClassName('prevbutton')[0] as HTMLDivElement;
  }

  public static getNext(): HTMLDivElement {
    return document.getElementsByClassName('nextbutton')[0] as HTMLDivElement;
  }

  /**
   * Get the current track index in the album
   * @returns The index of the currently playing track, or -1 if no track is playing
   */
  public static getCurrentTrackIndex(): number {
    const tracks = this.tracks;
    if (tracks.length === 0) {
      return -1;
    }
    
    const currentTrackRow = document.querySelector('.track_row_view.current_track');
    if (!currentTrackRow) {
      return -1;
    }
    
    return tracks.indexOf(currentTrackRow as HTMLTableRowElement);
  }

  public static navigateToTrack(trackIndex: number): void {
    ReleaseNavigation.navigateToTrack(trackIndex);
  }

  public static playNextReleaseTrack(): void {
    ReleaseNavigation.playNextReleaseTrack();
  }

  public static playPreviousReleaseTrack(): void {
    ReleaseNavigation.playPreviousReleaseTrack();
  }

  public static seekReset(): void {
    SeekUtils.seekReset(this.isCollectionBasedPage);
  }

  public static seekForward(step?: number): void {
    SeekUtils.seekForward(this.isCollectionBasedPage, step);
  }

  public static seekBackward(step?: number): void {
    SeekUtils.seekBackward(this.isCollectionBasedPage, step);
  }

  public static setSpeed(speed: number): void {
    if (this.audio.playbackRate !== speed) {
      this.audio.playbackRate = speed;
    }
  }

  public static setStretch(isStretch: boolean): void {
    if (typeof this.audio.mozPreservesPitch !== 'undefined') {
      this.audio.mozPreservesPitch = isStretch;
      return;
    }

    this.audio.preservesPitch = isStretch;
  }

  public static insertBelowPlayer(element: HTMLElement): void {
    const player = BandcampFacade.player;
    player.insertAdjacentElement('afterend', element);
  }

  public static insertBelowWaveform(element: HTMLElement): void {
    // Look for existing waveform container first
    const waveformContainer = document.querySelector(WAVEFORM_ELEMENT_SELECTOR);
    
    if (waveformContainer) {
      // Insert after the waveform
      waveformContainer.insertAdjacentElement('afterend', element);
    } else {
      // Fallback to inserting below player if no waveform exists
      this.insertBelowPlayer(element);
    }
  }

  public static insertBelowSpeedController(element: HTMLElement): void {
    // Look for existing speed controller first
    const speedController = document.querySelector(`.${SPEED_GRID_CLASS}`);
    
    if (speedController) {
      // Insert after the speed controller
      speedController.insertAdjacentElement('afterend', element);
    } else {
      // Fallback to inserting below player if no speed controller exists
      this.insertBelowPlayer(element);
    }
  }

  public static movePlaylist(): void {
    if (!this.isAlbum) {
      return;
    }

    const player = BandcampFacade.player;
    const tracks = BandcampFacade.trackTable;
    if (tracks) {
      player.insertAdjacentElement('afterend', tracks);
    }
  }

  public static playFirstTrack(): void {
    try {
      Logger.debug('=== PLAY FIRST TRACK ANALYSIS START ===');
      
      const tracks = BandcampFacade.trackTable;

      if (!tracks) {
        Logger.warn('No track table found for playFirstTrack');
        Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (no track table) ===');
        return;
      }

      Logger.debug(`Track table found with ${tracks.children.length} children`);
      const firstRow = tracks?.children[0]?.children[0] as HTMLTableRowElement;

      if (!firstRow) {
        Logger.warn('No first track row found');
        Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (no first row) ===');
        return;
      }

      Logger.debug(`First row found: ${firstRow.className}`);
      const firstPlayButton = firstRow?.children[0]?.children[0]
        ?.children[0] as HTMLDivElement;

      if (!firstPlayButton) {
        Logger.warn('No first track play button found');
        Logger.debug(`First row structure: children[0]=${firstRow.children[0]?.tagName}, children[0].children[0]=${firstRow.children[0]?.children[0]?.tagName}`);
        Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (no play button found - will use fallback) ===');
        
        // Fallback: try to click the main play button
        try {
          const mainPlayButton = this.getPlay();
          if (mainPlayButton) {
            Logger.warn('FALLBACK: clicking main play button instead of first track button');
            mainPlayButton.click();
          }
        } catch (fallbackError) {
          Logger.error('Error in playFirstTrack fallback:', fallbackError);
        }
        return;
      }

      Logger.debug(`First track play button found: ${firstPlayButton.className}`);
      
      // If the first track is already playing, don't click it again
      if (firstPlayButton.classList.contains('playing')) {
        Logger.debug('First track is already playing');
        Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (already playing) ===');
        return;
      }

      Logger.debug('Clicking FIRST TRACK play button (not main play button)');
      firstPlayButton.click();
      Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (success) ===');
    } catch (error) {
      Logger.error('Error in playFirstTrack:', error);
      
      // Fallback: try to click the main play button
      try {
        const mainPlayButton = this.getPlay();
        if (mainPlayButton) {
          Logger.warn('FALLBACK: clicking main play button due to error');
          mainPlayButton.click();
        }
      } catch (fallbackError) {
        Logger.error('Error in playFirstTrack fallback:', fallbackError);
      }
      Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (error fallback) ===');
    }
  }

  public static addCurrentAlbumToCart(): void {
    TrackActions.addCurrentAlbumToCart();
  }

  public static addCurrentTrackToCart(closeTabAfterAdd = false): void {
    TrackActions.addCurrentTrackToCart(closeTabAfterAdd);
  }

  public static toggleWishlist(): void {
    TrackActions.toggleWishlist();
  }

  public static toggleCurrentTrackWishlist(): void {
    TrackActions.toggleCurrentTrackWishlist();
  }

  public static rectifyMargins(): void {
    const player = BandcampFacade.player;
    const tracks = BandcampFacade.trackTable;

    if (player) {
      player.style.marginBottom = '1em';
    }

    if (tracks) {
      tracks.style.marginTop = '1em';
    }

    const prevCell = document.getElementsByClassName(
      'prev_cell',
    )[0] as HTMLTableCellElement;
    const nextCell = document.getElementsByClassName(
      'next_cell',
    )[0] as HTMLTableCellElement;

    prevCell.style.transform = 'translate(4px)';
    nextCell.style.transform = 'translate(4px)';
  }

  public static loadWishlistItems(): HTMLElement[] {
    return WishlistPlayback.loadWishlistItems();
  }

  public static playWishlistTrack(index: number): void {
    WishlistPlayback.playWishlistTrack(index);
  }

  public static playNextWishlistTrack(): void {
    WishlistPlayback.playNextWishlistTrack();
  }

  public static async playPreviousWishlistTrack(): Promise<void> {
    return WishlistPlayback.playPreviousWishlistTrack();
  }

  public static startWishlistPlayback(): void {
    WishlistPlayback.startWishlistPlayback();
  }

  public static isPlayingWishlistTrack(): boolean {
    return WishlistPlayback.isPlayingWishlistTrack();
  }

  public static setupWishlistContinuousPlayback(): void {
    WishlistPlayback.setupWishlistContinuousPlayback();
  }

  public static findPlayButton(item: HTMLElement): HTMLElement | null {
    return WishlistPlayback.findPlayButton(item);
  }

  public static togglePlayPause(): void {
    Transport.togglePlayPause();
  }

  public static async loadAllWishlistItems(): Promise<boolean> {
    return WishlistPlayback.loadAllWishlistItems();
  }

  /**
   * Reset all cached values and flags for SPA navigation
   */
  public static reset(): void {
    Logger.debug('BandcampFacade: Resetting cached values for SPA navigation');
    
    // Clear cached page type flags
    PageDetection.reset();
    
    // Clear cached data and colors
    BandcampFacade._data = undefined;
    BandcampFacade._colors = undefined;
    BandcampFacade._audio = undefined;
    
    // Reset wishlist navigation state
    BandcampFacade._wishlistItems = [];
    BandcampFacade._currentWishlistIndex = -1;
    
    // Reset error and navigation flags
    BandcampFacade._pendingNextTrackRequest = false;
    BandcampFacade._errorRecoveryInProgress = false;
    BandcampFacade._skipInProgress = false;
    BandcampFacade._consecutiveErrors = 0;
    BandcampFacade._errorLogSuppressed = false;
    BandcampFacade._releaseNavigationInProgress = false;
    
    // Reset shuffle service history
    ShuffleService.reset();
    
    Logger.debug('BandcampFacade: Reset completed');
  }

  /**
   * Check if there's a track currently playing or selected
   * @returns boolean indicating if a track is currently active
   */
  static hasCurrentlyPlayingTrack(): boolean {
    try {
      // Check if there's a track marked as currently playing
      const currentTrackRow = document.querySelector('.track_row_view.current_track, .track_row_view.playing');
      if (currentTrackRow) {
        return true;
      }
      
      // Check if any play button is in playing state
      const playingButton = document.querySelector('.playbutton.playing');
      if (playingButton) {
        return true;
      }
      
      // Check if audio has a valid source and has been played
      const audio = this.audio || AudioUtils.getAudioElement();
      if (audio && audio.src && !audio.src.includes('blob:') && audio.currentTime > 0) {
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error('Error checking for currently playing track:', error);
      return false;
    }
  }

}
