import {SEEK_STEP, TIMEOUT} from '../constants';

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
  private static _data: BandcampData;

  private static _isTrack: boolean;

  private static _isAlbum: boolean;

  private static _isWishlistPage: boolean;

  private static _colors: BandcampColors;

  private static _audio: HTMLAudioElement;

  private static _wishlistItems: HTMLElement[] = [];

  private static _currentWishlistIndex = -1;

  public static get data(): BandcampData {
    if (this._data) {
      return this._data;
    }

    const pageData = document.getElementById('pagedata');
    if (!pageData) {
      return null;
    }

    const dataBlob = pageData.getAttribute('data-blob');
    this._data = JSON.parse(dataBlob);

    return this._data;
  }

  public static get isTrack(): boolean {
    if (typeof this._isTrack !== 'undefined') {
      return this._isTrack;
    }

    this._isTrack = window.location.href.includes('/track/');

    return this._isTrack;
  }

  public static get isAlbum(): boolean {
    if (typeof this._isAlbum !== 'undefined') {
      return this._isAlbum;
    }

    this._isAlbum = !this.isTrack && document.getElementById('trackInfo') !== null;

    return this._isAlbum;
  }

  public static get isWishlistPage(): boolean {
    if (typeof this._isWishlistPage !== 'undefined') {
      return this._isWishlistPage;
    }

    this._isWishlistPage = window.location.href.includes('/wishlist');

    return this._isWishlistPage;
  }

  public static get colors(): BandcampColors {
    if (this._colors) {
      return this._colors;
    }

    const node = document.getElementById('custom-design-rules-style');

    if (!node) {
      setTimeout(() => this.colors, TIMEOUT);
      return;
    }

    this._colors = JSON.parse(node.getAttribute('data-design'));

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
    return BandcampFacade.isAlbum || BandcampFacade.isTrack;
  }

  public static get isLoggedIn(): boolean {
    return !document
      .getElementById('pagedata')
      .getAttribute('data-blob')
      .includes('"fan_tralbum_data":null');
  }

  public static get currentTrackContainer(): HTMLSpanElement {
    return document.querySelector('#trackInfo span.title');
  }

  public static get trackTable(): HTMLTableElement | null {
    return document.getElementById('track_table') as HTMLTableElement;
  }

  public static get tracks(): HTMLTableRowElement[] {
    const tracks = this.trackTable.querySelectorAll('.track_row_view');
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

    const artist = document.getElementById('name-section').children[1]
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

  public static seekReset(): void {
    this.audio.currentTime = 0;
  }

  public static seekForward(): void {
    this.audio.currentTime += SEEK_STEP;
  }

  public static seekBackward(): void {
    this.audio.currentTime -= SEEK_STEP;
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

  public static setVolume(volume: number): void {
    if (this.audio.volume !== volume) {
      this.audio.volume = volume;
    }
  }

  public static insertBelowPlayer(element: HTMLElement): void {
    const player = BandcampFacade.player;
    player.insertAdjacentElement('afterend', element);
  }

  public static movePlaylist(): void {
    if (!this.isAlbum) {
      return;
    }

    const player = BandcampFacade.player;
    const tracks = BandcampFacade.trackTable;
    player.insertAdjacentElement('afterend', tracks);
  }

  public static playFirstTrack(): void {
    const tracks = BandcampFacade.trackTable;

    if (!tracks) {
      return;
    }

    const firstRow = tracks?.children[0]?.children[0] as HTMLTableRowElement;

    if (!firstRow) {
      return;
    }

    const firstPlayButton = firstRow?.children[0]?.children[0]
      ?.children[0] as HTMLDivElement;

    if (!firstPlayButton) {
      return;
    }

    if (firstPlayButton.classList.contains('playing')) {
      return;
    }

    firstPlayButton.click();
  }

  public static toggleWishlist(): void {
    const {className} = this.wishlistButton;

    if (className === BandcampWishlistState.Liked) {
      const el = this.wishlistButton.children[1] as HTMLSpanElement;
      el.click();
    } else if (className === BandcampWishlistState.NotLiked) {
      const el = this.wishlistButton.firstElementChild as HTMLSpanElement;
      el.click();
    }
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

  /**
   * Load all wishlist items on the current page
   */
  public static loadWishlistItems(): HTMLElement[] {
    if (!this.isWishlistPage) {
      return [];
    }

    try {
      // Try different selectors for collection items
      const selectors = [
        '.collection-item-container',
        '.collection-item-gallery',
        '.collection-item',
        '.collection-items .item'
      ];
      
      let items: NodeListOf<HTMLElement> = null;
      
      // Try each selector until we find one that works
      for (const selector of selectors) {
        items = document.querySelectorAll(selector);
        if (items && items.length > 0) {
          break;
        }
      }
      
      if (!items || items.length === 0) {
        console.warn('No wishlist items found with any selector');
        return [];
      }
      
      // Find all items with play buttons
      this._wishlistItems = Array.from(items).filter(item => {
        const playButton = item.querySelector('.play-button, .play-col .playbutton, [class*="play"]');
        return playButton !== null;
      });
      
      console.log(`Found ${this._wishlistItems.length} playable wishlist items`);
      return this._wishlistItems;
    } catch (error) {
      console.error('Error loading wishlist items:', error);
      return [];
    }
  }

  /**
   * Play a specific track from the wishlist
   * @param index Index of the track to play
   */
  public static playWishlistTrack(index: number): void {
    if (!this.isWishlistPage || this._wishlistItems.length === 0) {
      return;
    }

    try {
      // Check if index is within bounds
      if (index < 0 || index >= this._wishlistItems.length) {
        return;
      }

      const item = this._wishlistItems[index];
      
      // Try different play button selectors
      const playButtonSelectors = [
        '.play-button',
        '.play-col .playbutton',
        '[class*="play"]',
        'button[title*="Play"], a[title*="Play"]'
      ];
      
      let playButton: HTMLElement = null;
      
      // Try each selector until we find a play button
      for (const selector of playButtonSelectors) {
        playButton = item.querySelector(selector) as HTMLElement;
        if (playButton) break;
      }
      
      if (playButton) {
        playButton.click();
        this._currentWishlistIndex = index;
        console.log(`Playing wishlist track ${index + 1} of ${this._wishlistItems.length}`);
      } else {
        console.warn(`No play button found for wishlist item at index ${index}`);
      }
    } catch (error) {
      console.error('Error playing wishlist track:', error);
    }
  }

  /**
   * Play the next track in the wishlist
   */
  public static playNextWishlistTrack(): void {
    if (!this.isWishlistPage || this._wishlistItems.length === 0) {
      return;
    }

    let nextIndex = this._currentWishlistIndex + 1;
    if (nextIndex >= this._wishlistItems.length) {
      nextIndex = 0; // Loop back to the first track
    }

    this.playWishlistTrack(nextIndex);
  }

  /**
   * Play the previous track in the wishlist
   */
  public static playPreviousWishlistTrack(): void {
    if (!this.isWishlistPage || this._wishlistItems.length === 0) {
      return;
    }

    let prevIndex = this._currentWishlistIndex - 1;
    if (prevIndex < 0) {
      prevIndex = this._wishlistItems.length - 1; // Loop back to the last track
    }

    this.playWishlistTrack(prevIndex);
  }

  /**
   * Start playing the wishlist from the beginning
   */
  public static startWishlistPlayback(): void {
    if (!this.isWishlistPage) {
      return;
    }

    // Load all wishlist items if not already loaded
    if (this._wishlistItems.length === 0) {
      this.loadWishlistItems();
    }

    if (this._wishlistItems.length > 0) {
      this.playWishlistTrack(0);
    }
  }

  /**
   * Check if currently playing a wishlist track
   */
  public static isPlayingWishlistTrack(): boolean {
    return this.isWishlistPage && this._currentWishlistIndex >= 0;
  }

  /**
   * Setup automatic playback of next track when current track ends
   */
  public static setupWishlistContinuousPlayback(): void {
    if (!this.isWishlistPage) {
      return;
    }

    try {
      // First make sure we have the audio element
      if (!this.audio) {
        console.warn('No audio element found for continuous playback');
        
        // Wait a bit and check again later - the audio element might not be ready yet
        setTimeout(() => {
          if (this.audio) {
            this.setupWishlistContinuousPlayback();
          }
        }, 2000);
        
        return;
      }

      // Remove any existing event listeners first to avoid duplicates
      this.audio.removeEventListener('ended', this.handleTrackEnded);
      
      // Add event listener for the audio element to detect when a track ends
      this.audio.addEventListener('ended', this.handleTrackEnded);
      
      console.log('Continuous playback setup complete');
    } catch (error) {
      console.error('Error setting up continuous playback:', error);
    }
  }
  
  /**
   * Handler for when a track ends - plays the next track
   */
  private static handleTrackEnded = () => {
    // Use BandcampFacade instead of this to avoid reference issues
    if (BandcampFacade.isWishlistPage && BandcampFacade._currentWishlistIndex >= 0) {
      BandcampFacade.playNextWishlistTrack();
    }
  }

  /**
   * Toggle play/pause for the current track or start playing the first track
   * Works for both regular player and wishlist pages
   */
  public static togglePlayPause(): void {
    // Handle wishlist page specifically
    if (this.isWishlistPage) {
      try {
        // If no track is currently playing, start playing the first track
        if (this._currentWishlistIndex === -1) {
          this.startWishlistPlayback();
          return;
        }
        
        // If a track is playing, find and click the play/pause button
        const audioElement = this.audio;
        if (audioElement) {
          if (audioElement.paused) {
            audioElement.play();
          } else {
            audioElement.pause();
          }
        }
      } catch (error) {
        console.error('Error toggling play/pause on wishlist page:', error);
      }
      return;
    }
    
    // Handle regular player pages
    const playButton = this.getPlay();
    if (playButton) {
      playButton.click();
    }
  }

  /**
   * Toggle the current track in the wishlist
   */
  public static toggleCurrentTrackWishlist(): void {
    try {
      if (!this.isLoggedIn) {
        console.warn('User is not logged in, cannot toggle wishlist');
        return;
      }
      
      // Find the currently playing track's wishlist controls
      const currentPlayer = document.querySelector('.carousel-player-inner');
      if (!currentPlayer) return;
      
      // Look for wishlist controls in the player
      const wishlistControls = currentPlayer.querySelector('.item-collection-controls');
      if (!wishlistControls) return;
      
      // Check if it's already wishlisted
      const isWishlisted = wishlistControls.classList.contains('wishlisted');
      
      // Find the appropriate button to click
      if (isWishlisted) {
        // Find the "in wishlist" button (to remove from wishlist)
        const removeButton = wishlistControls.querySelector('.wishlisted-msg a');
        if (removeButton) {
          console.log('Removing current track from wishlist');
          (removeButton as HTMLElement).click();
        }
      } else {
        // Find the "wishlist" button (to add to wishlist)
        const addButton = wishlistControls.querySelector('.wishlist-msg a');
        if (addButton) {
          console.log('Adding current track to wishlist');
          (addButton as HTMLElement).click();
        }
      }
    } catch (error) {
      console.error('Error toggling current track wishlist:', error);
    }
  }
}
