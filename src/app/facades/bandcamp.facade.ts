import {SEEK_STEP, TIMEOUT} from '../constants';
import {Logger} from '../utils/logger';
import {AudioUtils} from '../utils/audio-utils';
import {SeekUtils} from '../utils/seek-utils';
import {ErrorHandler} from '../utils/error-handler';
import {DOMSelectors} from '../utils/dom-selectors';
import {BuyUtils} from '../utils/buy-utils';
import {WishlistService} from '../services/wishlist.service';

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
  private static _data: BandcampData;

  private static _isTrack: boolean;

  private static _isAlbum: boolean;

  private static _isWishlistPage: boolean;

  private static _colors: BandcampColors;

  private static _audio: HTMLAudioElement;

  private static _wishlistItems: HTMLElement[] = [];

  private static _currentWishlistIndex = -1;

  private static _pendingNextTrackRequest = false;
  private static _errorRecoveryInProgress = false;
  private static _skipInProgress = false;
  private static _consecutiveErrors = 0;
  private static _maxConsecutiveErrors = 3;
  private static _errorLogSuppressed = false;
  // _playAttemptMade is already declared at line 59

  // Static list to keep track of problematic track IDs that return 404s
  private static _problemTrackIds: Set<string> = new Set();

  /**
   * Checks if the current track ID is in our known problem list
   */
  private static checkForProblemTrackId(): boolean {
    if (BandcampFacade._currentWishlistIndex >= 0 && BandcampFacade._wishlistItems.length > 0) {
      const currentItem = BandcampFacade._wishlistItems[BandcampFacade._currentWishlistIndex];
      if (currentItem) {
        const trackId = currentItem.getAttribute('data-track-id');
        if (trackId && BandcampFacade._problemTrackIds.has(trackId)) {
        Logger.info(`Track ID ${trackId} is in our problem list, skipping it`);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Adds a track ID to our problem list if it's not already there
   * Returns true if the track was added to the problem list
   */
  private static addProblemTrackIdIfNeeded(trackId: string): boolean {
    if (!BandcampFacade._problemTrackIds.has(trackId)) {
      // Check if this is track ID 3302866485 or has already caused 404 errors
      if (trackId === '3302866485' || document.documentElement.innerHTML.includes('404 (Not Found)')) {
        Logger.info(`Adding track ID ${trackId} to problem list`);
        BandcampFacade._problemTrackIds.add(trackId);
        return true;
      }
    }
    return false;
  }

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
    SeekUtils.seekReset(this.isWishlistPage);
  }

  public static seekForward(): void {
    SeekUtils.seekForward(this.isWishlistPage);
  }

  public static seekBackward(): void {
    SeekUtils.seekBackward(this.isWishlistPage);
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
    try {
      Logger.info('Attempting to toggle wishlist for entire release');
      
      // Use centralized wishlist service
      const success = WishlistService.clickWishlistToggleInUI();
      
      if (!success) {
        Logger.warn('Could not find appropriate wishlist button to click');
      }
    } catch (error) {
      ErrorHandler.withErrorHandling(() => { throw error; }, 'Error in toggleWishlist');
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
      Logger.info('Loading wishlist items...');
      
      // Try different selectors for collection items - in most recent Bandcamp design
      let items: HTMLElement[] = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.WISHLIST_ITEMS);
      
      if (items.length > 0) {
        Logger.info(`Found ${items.length} wishlist items`);
      }
      
      if (!items || items.length === 0) {
        Logger.warn('No wishlist items found with any selector, trying more general selectors');
        
        // Try more general selectors as a fallback
        items = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.WISHLIST_ITEMS_FALLBACK);
        
        if (items.length > 0) {
          Logger.info(`Found ${items.length} items with fallback selectors`);
        }
        
        if (!items || items.length === 0) {
          Logger.warn('No wishlist items found with any selector');
          return [];
        }
      }
      
      // Find all items with play buttons or other interactive elements
      this._wishlistItems = items.filter(item => {
        // Check if the item has a play button or other meaningful data
        const playButton = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.PLAY_BUTTONS, item);
        const hasPlayButton = playButton !== null;
        
        // Check if the item has a data-tralbum-id or data-item-id attribute
        const hasTralbumId = item.hasAttribute('data-tralbum-id') || 
                             item.hasAttribute('data-item-id') ||
                             item.querySelector('[data-tralbum-id], [data-item-id]') !== null;
                             
        // Check if it has an album or track link
        const hasLink = item.querySelector('a[href*="/album/"], a[href*="/track/"]') !== null;
        
        // Include the item if it has any of these features
        return hasPlayButton || hasTralbumId || hasLink;
      });
      
      // Extract and store trackIds for each item, and attach play listeners
      this._wishlistItems.forEach((item, index) => {
        this.extractTrackId(item, index);
        
        // Attach listener to update index on manual play
        const playButton = this.findPlayButton(item);
        if (playButton) {
          // Use a data attribute to prevent attaching multiple listeners
          if (!playButton.getAttribute('data-bcwf-play-listener')) {
            const listener = (event: MouseEvent) => {
              // Check if the click is directly on the button or a child element that should trigger play
              // This helps avoid unintended index updates from clicks elsewhere in the item
              const target = event.target as HTMLElement;
              if (playButton.contains(target)) {
                 Logger.info(`Manual play detected on wishlist item index: ${index}`);
                 BandcampFacade._currentWishlistIndex = index;
                 // Ensure continuous playback listeners are (re)attached after a short delay
                 // in case Bandcamp swaps the audio element on play.
                 setTimeout(() => BandcampFacade.setupWishlistContinuousPlayback(), 50);
                 // Let Bandcamp's default behavior handle the actual playback.
              }
            };
            playButton.addEventListener('click', listener);
            playButton.setAttribute('data-bcwf-play-listener', 'true'); // Mark as attached
          }
        }
      });
      
      Logger.info(`Found ${this._wishlistItems.length} playable wishlist items`);
      return this._wishlistItems;
    } catch (error) {
      ErrorHandler.withErrorHandling(() => { throw error; }, 'Error loading wishlist items');
      return [];
    }
  }
  
  /**
   * Extract the track ID from a wishlist item and store it
   * @param item The wishlist item element
   * @param index The index of the item
   */
  private static extractTrackId(item: HTMLElement, index: number): void {
    try {
      // First, check for data attributes that might contain the track ID
      let trackId = null;
      
      // 1. Check if the item itself has a data-tralbum-id attribute
      if (item.hasAttribute('data-tralbum-id')) {
        trackId = item.getAttribute('data-tralbum-id');
      }
      
      // 2. Check for data-item-id attribute
      else if (item.hasAttribute('data-item-id')) {
        trackId = item.getAttribute('data-item-id');
      }
      
      // 3. Check for child elements with data-tralbum-id or data-item-id
      else {
        const tralbumElement = item.querySelector('[data-tralbum-id]');
        if (tralbumElement) {
          trackId = tralbumElement.getAttribute('data-tralbum-id');
        } else {
          const itemIdElement = item.querySelector('[data-item-id]');
          if (itemIdElement) {
            trackId = itemIdElement.getAttribute('data-item-id');
          }
        }
      }
      
      // 4. Check for new Bandcamp format (data-id, data-itemid, etc.)
      if (!trackId) {
        const possibleIdAttributes = ['data-id', 'data-itemid', 'data-album-id', 'data-track-id'];
        
        for (const attr of possibleIdAttributes) {
          // Check on the item itself
          if (item.hasAttribute(attr)) {
            trackId = item.getAttribute(attr);
            break;
          }
          
          // Check on child elements
          const elementWithAttr = item.querySelector(`[${attr}]`);
          if (elementWithAttr) {
            trackId = elementWithAttr.getAttribute(attr);
            break;
          }
        }
      }

      // 5. Extract track ID from URLs
      if (!trackId) {
        // Look for album links
        const albumLinks = DOMSelectors.findWithSelectors<HTMLAnchorElement>(['a[href*="/album/"]'], item);
        if (albumLinks.length > 0) {
          const url = albumLinks[0].getAttribute('href');
          // Store the album URL as a fallback
          item.setAttribute('data-album-url', url);
          
          // Try to extract the ID from the URL query parameters
          const match = url.match(/[?&]item_id=([^&]+)/);
          if (match && match[1]) {
            trackId = match[1];
          } else {
            // Try to extract from path segments (newer Bandcamp format)
            const pathSegments = url.split('/');
            if (pathSegments.length > 4) {
              // Get the last segment which might contain the ID
              const lastSegment = pathSegments[pathSegments.length - 1];
              if (/^\d+$/.test(lastSegment)) {
                // If it's a numeric ID
                trackId = lastSegment;
              }
            }
          }
        }

        // Look for track links
        if (!trackId) {
          const trackLinks = DOMSelectors.findWithSelectors<HTMLAnchorElement>(['a[href*="/track/"]'], item);
          if (trackLinks.length > 0) {
            const url = trackLinks[0].getAttribute('href');
            // Store the track URL as a fallback
            item.setAttribute('data-track-url', url);
            
            // Try to extract the ID from the URL
            const match = url.match(/[?&]item_id=([^&]+)/);
            if (match && match[1]) {
              trackId = match[1];
            } else {
              // Try to extract from path segments (newer Bandcamp format)
              const pathSegments = url.split('/');
              if (pathSegments.length > 4) {
                // Get the last segment which might contain the ID
                const lastSegment = pathSegments[pathSegments.length - 1];
                if (/^\d+$/.test(lastSegment)) {
                  // If it's a numeric ID
                  trackId = lastSegment;
                }
              }
            }
          }
        }
      }
      
      // 6. Look for ID in URL of any image with a specific src pattern
      if (!trackId) {
        const images = DOMSelectors.findWithSelectors<HTMLImageElement>(DOMSelectors.BANDCAMP_IMAGES, item);
        for (const img of images) {
          const src = img.getAttribute('src');
          if (src) {
            // Pattern like "a1234567890_10.jpg" where the number is the ID
            const match = src.match(/a(\d+)_\d+\.jpg/);
            if (match && match[1]) {
              trackId = match[1];
              break;
            }
          }
        }
      }
      
      // 7. Check for embedded itemprops or structured data
      if (!trackId) {
        const itemProps = item.querySelector('[itemprop="url"], [itemtype*="MusicRecording"]');
        if (itemProps) {
          const href = itemProps.getAttribute('href') || itemProps.getAttribute('content');
          if (href) {
            // Store as a fallback URL
            item.setAttribute('data-track-href', href);
            
            // Try to extract ID from the URL
            const match = href.match(/[?&]item_id=([^&]+)/);
            if (match && match[1]) {
              trackId = match[1];
            } else {
              // Try to extract from path segments
              const pathSegments = href.split('/');
              if (pathSegments.length > 4) {
                // Get the last segment which might contain the ID
                const lastSegment = pathSegments[pathSegments.length - 1];
                if (/^\d+$/.test(lastSegment)) {
                  // If it's a numeric ID
                  trackId = lastSegment;
                }
              }
            }
          }
        }
      }
      
      // 8. Check for inline script data (JSON-LD)
      if (!trackId) {
        const scriptElements = DOMSelectors.findWithSelectors<HTMLScriptElement>(DOMSelectors.JSON_LD_SCRIPTS, item);
        for (const script of scriptElements) {
          try {
            const jsonData = JSON.parse(script.textContent);
            if (jsonData) {
              // Check for URL
              if (jsonData.url) {
                item.setAttribute('data-track-json-url', jsonData.url);
                const match = jsonData.url.match(/[?&]item_id=([^&]+)/);
                if (match && match[1]) {
                  trackId = match[1];
                  break;
                }
              }
              
              // Check for ID directly in JSON
              if (jsonData.id || jsonData.identifier) {
                trackId = jsonData.id || jsonData.identifier;
                break;
              }
            }
          } catch (e) {
            // Ignore JSON parsing errors
          }
        }
      }
      
      // 9. Try to find the track ID in any data attribute
      if (!trackId) {
        // Get all data attributes on the item
        const dataAttributes: Record<string, string> = {};
        
        // Safely convert NamedNodeMap to a usable object
        Array.from(item.attributes).forEach(attr => {
          if (attr.name.startsWith('data-')) {
            dataAttributes[attr.name] = attr.value;
          }
        });
        
        // Look for anything that might be an ID (numeric or with specific patterns)
        for (const attrName of Object.keys(dataAttributes)) {
          const attrValue = dataAttributes[attrName];
          if (
            /\d+/.test(attrValue) && // Contains numbers
            (attrName.includes('id') || attrName.includes('item') || attrName.includes('track') || attrName.includes('album'))
          ) {
            trackId = attrValue;
            Logger.info(`Found potential track ID in data attribute ${attrName}: ${attrValue}`);
            break;
          }
        }
      }
      
      // Store the track ID as a data attribute on the item element
      if (trackId) {
        item.setAttribute('data-track-id', trackId);
        Logger.info(`Successfully extracted track ID for item ${index}: ${trackId}`);
      } else {
        // Generate a fallback ID
        const uniqueId = `generated-${index}-${Date.now()}`;
        item.setAttribute('data-generated-id', uniqueId);
        Logger.info(`Could not find track ID for item ${index}`);
        
        // Store any URLs we found as data attributes for fallback
        if (!item.hasAttribute('data-track-href')) {
          const anyLink = item.querySelector('a');
          if (anyLink) {
            item.setAttribute('data-track-href', anyLink.getAttribute('href'));
          }
        }
      }      } catch (error) {
        ErrorHandler.withErrorHandling(() => { throw error; }, `Error extracting track ID for item ${index}`);
      }
  }

  /**
   * Play a specific track from the wishlist
   * @param index Index of the track to play
   */
  public static playWishlistTrack(index: number): void {
    if (!this.isWishlistPage || this._wishlistItems.length === 0) {
      Logger.warn('Cannot play wishlist track - not on wishlist page or no items loaded');
      return;
    }

    try {
      // Check if index is within bounds
      if (index < 0 || index >= this._wishlistItems.length) {
        Logger.warn(`Track index ${index} is out of bounds (0-${this._wishlistItems.length - 1})`);
        return;
      }

      const item = this._wishlistItems[index];
      
      // Store the current index
      this._currentWishlistIndex = index;
      
      Logger.info(`Attempting to play wishlist track ${index + 1} of ${this._wishlistItems.length}`);
      
      // Try to find and click the play button directly
      let playButton = this.findPlayButton(item);
      
      if (playButton) {
        Logger.info(`Found play button for wishlist track ${index + 1}, clicking it`);
        playButton.click();
        
        // Verify if playback started after a short delay
        setTimeout(() => {
          const audio = AudioUtils.getAudioElement();
          
          // If audio isn't playing within 1 second, move to next track
          if (!audio || audio.paused || !audio.src || audio.src.includes('track_id=&')) {
            Logger.info(`Track ${index + 1} failed to play, moving to next track`);
            this.playNextWishlistTrack();
          } else {
            Logger.info(`Track ${index + 1} is playing successfully`);
          }
        }, 1000);
        
        return;
      }
      
      // No play button found, try to click an item to select it
      Logger.info(`No play button found for track ${index + 1}, trying to click the item itself`);
      
      // Try to find any clickable element
      const clickableElements = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.CLICKABLE_ELEMENTS, item);
      
      if (clickableElements.length > 0) {
        // Try to click the first element that isn't an explicit "buy" or "share" button
        let clicked = false;
        
        for (let i = 0; i < clickableElements.length; i++) {
          const element = clickableElements[i] as HTMLElement;
          const text = element.textContent?.toLowerCase() || '';
          
          if (!text.includes('buy') && !text.includes('share') && !text.includes('wishlist')) {
            Logger.info(`Clicking element to select track`);
            element.click();
            clicked = true;
            
            // Try to find and click play button in the now-focused track
            setTimeout(() => {
              const playButton = document.querySelector('.carousel-player-inner .playbutton, .play-button');
              if (playButton) {
                Logger.info('Found play button in focused track, clicking it');
                (playButton as HTMLElement).click();
                
                // Check if playback started
                setTimeout(() => {
                  const audio = AudioUtils.getAudioElement();
                  if (!audio || audio.paused) {
                    Logger.info(`Track ${index + 1} failed to play after selection, moving to next track`);
                    this.playNextWishlistTrack();
                  }
                }, 1000);
              } else {
                Logger.info('No play button found after selection, moving to next track');
                this.playNextWishlistTrack();
              }
            }, 500);
            
            break;
          }
        }
        
        if (!clicked) {
          Logger.info('No suitable clickable element found, moving to next track');
          this.playNextWishlistTrack();
        }
      } else {
        Logger.info('No clickable elements found, moving to next track');
        this.playNextWishlistTrack();
      }
    } catch (error) {
      ErrorHandler.withErrorHandling(() => { throw error; }, 'Error playing wishlist track');
      // On any error, move to the next track
      setTimeout(() => this.playNextWishlistTrack(), 500);
    }
  }

  /**
   * Play the next track in the wishlist
   */
  public static playNextWishlistTrack(): void {
    if (!this.isWishlistPage || this._wishlistItems.length === 0) {
      return;
    }

    // Check if we already have a pending next track request
    if (this._pendingNextTrackRequest || this._skipInProgress) {
      Logger.info('Already processing a track change request, ignoring additional request');
      return;
    }

    // Set a flag to prevent multiple concurrent skip requests
    this._pendingNextTrackRequest = true;
    this._skipInProgress = true;

    // Use a delay to ensure any previous track operations have completed
    setTimeout(() => {
      let nextIndex = this._currentWishlistIndex + 1;
      if (nextIndex >= this._wishlistItems.length) {
        nextIndex = 0; // Loop back to the first track
      }

      Logger.info(`Playing next wishlist track (${nextIndex + 1} of ${this._wishlistItems.length})`);
      this.playWishlistTrack(nextIndex);
      
      // Clear the pending flag after a delay to prevent rapid successive skips
      setTimeout(() => {
        this._pendingNextTrackRequest = false;
        
        // Only clear the skip flag after a longer delay to ensure the track has time to start
        setTimeout(() => {
          this._skipInProgress = false;
        }, 1000);
      }, 500);
    }, 500);
  }

  /**
   * Play the previous track in the wishlist
   */
  public static async playPreviousWishlistTrack(): Promise<void> {
    if (!this.isWishlistPage || this._wishlistItems.length === 0) {
      return;
    }

    // Check if we already have a pending track request
    if (this._pendingNextTrackRequest || this._skipInProgress) {
      Logger.info('Already processing a track change request, ignoring additional request');
      return;
    }

    // Set a flag to prevent multiple concurrent skip requests
    this._pendingNextTrackRequest = true;
    this._skipInProgress = true;

    // Use a delay to ensure any previous track operations have completed
    setTimeout(async () => {
      // If we're trying to go to the previous track from the first track (index 0),
      // ensure all wishlist items are loaded to get the correct "last" track
      if (this._currentWishlistIndex === 0) {
        Logger.info('At first track, ensuring all wishlist items are loaded before going to last track');
        try {
          const loadSuccess = await this.loadAllWishlistItems();
          if (loadSuccess) {
            // Reload wishlist items to get the updated array
            this.loadWishlistItems();
            Logger.info(`Updated wishlist items count: ${this._wishlistItems.length}`);
          } else {
            Logger.warn('Failed to load all wishlist items, using current list');
          }
        } catch (error) {
          Logger.warn('Error loading all wishlist items, using current list:', error);
        }
      }

      let prevIndex = this._currentWishlistIndex - 1;
      if (prevIndex < 0) {
        prevIndex = this._wishlistItems.length - 1; // Loop back to the last track
      }

      // Check if the previous track is in our problem list
      const item = this._wishlistItems[prevIndex];
      const trackId = item?.getAttribute('data-track-id');
      
      if (trackId && this._problemTrackIds.has(trackId)) {
        Logger.info(`Previous track (${prevIndex + 1}) has known issues, skipping it`);
        
        // Calculate the next valid previous index
        let nextValidPrevIndex = prevIndex - 1;
        if (nextValidPrevIndex < 0) {
          nextValidPrevIndex = this._wishlistItems.length - 1;
        }
        
        // Recursively try to find a valid previous track
        let attemptsLeft = this._wishlistItems.length; // Prevent infinite loop
        let foundValidTrack = false;
        
        while (attemptsLeft > 0 && !foundValidTrack) {
          const candidateItem = this._wishlistItems[nextValidPrevIndex];
          const candidateTrackId = candidateItem?.getAttribute('data-track-id');
          
          if (!candidateTrackId || !this._problemTrackIds.has(candidateTrackId)) {
            // Found a track that's not in our problem list
            prevIndex = nextValidPrevIndex;
            foundValidTrack = true;
            Logger.info(`Found valid previous track at index ${prevIndex + 1}`);
          } else {
            // This track is also problematic, go to previous one
            nextValidPrevIndex--;
            if (nextValidPrevIndex < 0) {
              nextValidPrevIndex = this._wishlistItems.length - 1;
            }
            attemptsLeft--;
          }
        }
        
        if (!foundValidTrack) {
          Logger.warn('Could not find any valid previous tracks, staying on current track');
          this._pendingNextTrackRequest = false;
          this._skipInProgress = false;
          return;
        }
      }

      Logger.info(`Playing previous wishlist track (${prevIndex + 1} of ${this._wishlistItems.length})`);
      this.playWishlistTrack(prevIndex);
      
      // Clear the pending flag after a delay to prevent rapid successive skips
      setTimeout(() => {
        this._pendingNextTrackRequest = false;
        
        // Only clear the skip flag after a longer delay to ensure the track has time to start
        setTimeout(() => {
          this._skipInProgress = false;
        }, 1000);
      }, 500);
    }, 500);
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
      Logger.info(`Starting wishlist playback with ${this._wishlistItems.length} items`);
      this.playWishlistTrack(0);
    } else {
      Logger.warn('No wishlist items found to play');
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
      Logger.info('Setting up continuous playback for wishlist');
      
      // Wait for the audio element to be created (it might not exist immediately)
      const setupAudioListeners = () => {
        // Find the audio element
        const audio = AudioUtils.getAudioElement();
        if (!audio) {
          Logger.info('No audio element found yet, will check again soon');
          setTimeout(setupAudioListeners, 1000);
          return;
        }
        
        Logger.info('Found audio element, setting up ended event listener');
        
        // Remove any existing event listeners first to avoid duplicates
        audio.removeEventListener('ended', this.handleTrackEnded);
        
        // Add event listener for the audio element to detect when a track ends
        audio.addEventListener('ended', this.handleTrackEnded);
        
        // Also monitor for errors in playback
        audio.removeEventListener('error', this.handleAudioError);
        audio.addEventListener('error', this.handleAudioError);
        
        // Add a loadstart event listener to catch and fix missing track IDs before they cause errors
        audio.removeEventListener('loadstart', this.handleAudioLoadStart);
        audio.addEventListener('loadstart', this.handleAudioLoadStart);
        
        Logger.info('Continuous playback setup complete');
      };
      
      // Start setting up listeners
      setupAudioListeners();
      
    } catch (error) {
      ErrorHandler.withErrorHandling(() => { throw error; }, 'Error setting up continuous playback');
    }
  }
  
  /**
   * Handler for when a track ends - plays the next track
   */
  private static handleTrackEnded = () => {
    Logger.info('Track ended, playing next track');
    // Use BandcampFacade instead of this to avoid reference issues
    if (BandcampFacade.isWishlistPage && BandcampFacade._currentWishlistIndex >= 0) {
      BandcampFacade.playNextWishlistTrack();
    }
  }
  
  /**
   * Handle audio errors and attempt to recover or skip to next track
   */
  private static handleAudioError = (event: Event) => {
    const audio = event.target as HTMLAudioElement;
    const error = audio.error;
    
    Logger.warn('Audio playback error:', error);
    
    // Stop if we're already processing an error
    if (BandcampFacade._errorRecoveryInProgress) {
      Logger.info('Already recovering from an error, ignoring additional error events');
      return;
    }
    
    // Set flag to prevent multiple error handlers from running simultaneously
    BandcampFacade._errorRecoveryInProgress = true;
    
    try {
      Logger.info('Attempting to recover from audio error');
      
      // Extract track ID from the current URL if possible
      let trackId = null;
      if (audio.src && audio.src.includes('track_id=')) {
        const urlParams = new URLSearchParams(audio.src.split('?')[1]);
        trackId = urlParams.get('track_id');
      }
      
      // If we have a track ID, add it to the problem list
      if (trackId && trackId !== '') {
        Logger.info(`[Bandcamp+] Adding track ID ${trackId} to problem list due to playback error`);
        BandcampFacade._problemTrackIds.add(trackId);
      }
      
      // Handle specific error types
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            Logger.info('Network error detected, attempting to reload audio');
            if (!BandcampFacade._skipInProgress) {
              BandcampFacade._skipInProgress = true;
              setTimeout(() => {
                BandcampFacade._skipInProgress = false;
                BandcampFacade._errorRecoveryInProgress = false;
                if (BandcampFacade.isWishlistPage) {
                  BandcampFacade.playNextWishlistTrack();
                }
              }, 500);
            }
            break;
            
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          case MediaError.MEDIA_ERR_DECODE:
            Logger.info('Media format error detected, skipping to next track immediately');
            if (!BandcampFacade._skipInProgress) {
              BandcampFacade._skipInProgress = true;
              setTimeout(() => {
                BandcampFacade._skipInProgress = false;
                BandcampFacade._errorRecoveryInProgress = false;
                if (BandcampFacade.isWishlistPage) {
                  BandcampFacade.playNextWishlistTrack();
                }
              }, 500);
            }
            break;
            
          default:
            Logger.info('Unrecoverable audio error, skipping to next track');
            if (!BandcampFacade._skipInProgress) {
              BandcampFacade._skipInProgress = true;
              setTimeout(() => {
                BandcampFacade._skipInProgress = false;
                BandcampFacade._errorRecoveryInProgress = false;
                if (BandcampFacade.isWishlistPage) {
                  BandcampFacade.playNextWishlistTrack();
                }
              }, 500);
            }
            break;
        }
      } else {
        Logger.info('Unrecoverable audio error, skipping to next track');
        if (!BandcampFacade._skipInProgress) {
          BandcampFacade._skipInProgress = true;
          setTimeout(() => {
            BandcampFacade._skipInProgress = false;
            BandcampFacade._errorRecoveryInProgress = false;
            if (BandcampFacade.isWishlistPage) {
              BandcampFacade.playNextWishlistTrack();
            }
          }, 500);
        }
      }
    } catch (e) {
      Logger.error('Error in audio error handler:', e);
      BandcampFacade._errorRecoveryInProgress = false;
      BandcampFacade._skipInProgress = false;
    }
  }
  
  /**
   * Helper method to try the next recovery method for audio playback
   * @param audio The audio element
   * @param currentItem The current wishlist item
   * @param trackId The track ID
   */
  private static tryNextRecoveryMethod(audio: HTMLAudioElement, currentItem: HTMLElement, trackId: string): void {
    try {
      // Try to manually create a stream URL with the track ID
      const urlParts = audio.src.split('?');
      const baseUrl = urlParts[0];
      const params = new URLSearchParams(urlParts.length > 1 ? urlParts[1] : '');
      
      // Explicitly set the track_id parameter
      params.set('track_id', trackId);
      
      // Update the timestamp
      const timestamp = Math.floor(Date.now() / 1000);
      params.set('ts', timestamp.toString());
      
      // Create a new URL with corrected parameters
      const newUrl = `${baseUrl}?${params.toString()}`;
      Logger.info(`Created fixed stream URL: ${newUrl}`);
      
      // Set the new URL and attempt playback
      audio.src = newUrl;
      audio.load();
      
      // Give more time for the audio to load and play
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          ErrorHandler.withErrorHandling(() => { throw e; }, 'Error playing with fixed URL');
          
          // Try a second approach - create a completely new URL
          const directStreamUrl = `https://bandcamp.com/stream_redirect?enc=mp3-128&track_id=${trackId}&ts=${timestamp}`;
          Logger.info(`Trying direct stream URL: ${directStreamUrl}`);
          
          audio.src = directStreamUrl;
          audio.load();
          audio.play().catch(innerError => {
            ErrorHandler.withErrorHandling(() => { throw innerError; }, 'Error playing with direct URL');
            
            // Wait longer before giving up on this track
            setTimeout(() => {
              if (audio && !(audio as HTMLAudioElement).paused) {
                Logger.info('Direct URL approach eventually succeeded');
                BandcampFacade._errorRecoveryInProgress = false;
                BandcampFacade._consecutiveErrors = 0;
              } else {
                Logger.warn('All URL fixes failed, will attempt to skip track');
                
                // Try clicking the play button again as last resort
                const playButton = BandcampFacade.findPlayButton(currentItem);
                if (playButton) {
                  Logger.info('Trying to recover by clicking play button');
                  playButton.click();
                  
                  // Check after a longer delay if this approach worked
                  setTimeout(() => {
                    if (audio && !(audio as HTMLAudioElement).paused) {
                      Logger.info('Play button click recovery was successful');
                      BandcampFacade._errorRecoveryInProgress = false;
                      BandcampFacade._consecutiveErrors = 0;
                    } else {
                      Logger.warn('Play button click failed to recover playback');
                      // Skip to the next track after a longer delay to avoid race conditions
                      setTimeout(() => {
                        BandcampFacade._errorRecoveryInProgress = false;
                        Logger.info('Skipping to next track after attempted recovery');
                        BandcampFacade.playNextWishlistTrack();
                      }, 2000);
                    }
                  }, 2000);
                } else {
                  // If all else fails, skip to the next track
                  Logger.info('Could not recover current track, skipping to next');
                  // Add a delay before skipping to avoid race conditions
                  setTimeout(() => {
                    BandcampFacade._errorRecoveryInProgress = false;
                    BandcampFacade.playNextWishlistTrack();
                  }, 2000);
                }
              }
            }, 2000);
          });
        });
      }
      
      // Check after a delay if the recovery was successful
      setTimeout(() => {
        if (audio && !(audio as HTMLAudioElement).paused) {
          Logger.info('Fixed URL recovery was successful');
          BandcampFacade._errorRecoveryInProgress = false;
          BandcampFacade._consecutiveErrors = 0;
        } else {
          // The check in the error callback will handle this case
          Logger.info('Waiting for recovery attempt result...');
        }
      }, 1500);
      
    } catch (urlError) {
      Logger.error('Error creating fixed URL:', urlError);
      
      // Release the error recovery flag after a suitable delay
      setTimeout(() => {
        BandcampFacade._errorRecoveryInProgress = false;
        BandcampFacade.playNextWishlistTrack();
      }, 2000);
    }
  }
  
  /**
   * Find a play button element within a wishlist item
   * @param item The wishlist item element
   * @returns The play button element or null if not found
   */
  public static findPlayButton(item: HTMLElement): HTMLElement | null {
    try {
      // Try multiple selectors for play buttons that might exist in the item
      const button = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.PLAY_BUTTONS, item);
      if (button) {
        return button;
      }
      
      // Check for any element with an onclick handler that might be a play button
      const clickElements = Array.from(item.querySelectorAll('*[onclick]'));
      for (const element of clickElements) {
        const onclick = element.getAttribute('onclick');
        if (onclick && (onclick.includes('play') || onclick.includes('Play'))) {
          return element as HTMLElement;
        }
      }
      
      // Look for elements with typical play button styling or icon classes
      const elements = Array.from(item.querySelectorAll('*'));
      for (const element of elements) {
        // Check class names for play indicators
        const classNames = element.className || '';
        if (typeof classNames === 'string' && 
            (classNames.includes('play') || 
             classNames.includes('Play') || 
             classNames.includes('control'))) {
          return element as HTMLElement;
        }
        
        // Check for typical play button icons (font awesome, etc)
        const children = element.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.nodeName === 'I' || child.nodeName === 'SPAN') {
            const childClass = child.className || '';
            if (typeof childClass === 'string' && 
                (childClass.includes('fa-play') || 
                 childClass.includes('icon-play') || 
                 childClass.includes('play-icon'))) {
              return element as HTMLElement;
            }
          }
        }
      }
      
      // Final fallback - any element with 'play' in its attribute values
      for (const element of elements) {
        const attributes = Array.from(element.attributes);
        for (const attr of attributes) {
          if (attr.value.toLowerCase().includes('play')) {
            return element as HTMLElement;
          }
        }
      }
      
      // No play button found
      return null;
    } catch (error) {
      ErrorHandler.withErrorHandling(() => { throw error; }, 'Error finding play button');
      return null;
    }
  }
  
  /**
   * Verify if the current wishlist track is playing correctly
   * @param index The index of the track that should be playing
   */
  private static verifyWishlistPlayback(index: number): void {
    // Verify that audio is actually playing
    const audio = AudioUtils.getAudioElement();
    
    if (!audio) {
      Logger.warn('No audio element found during playback verification');
      return;
    }
    
    // Check if the audio is playing and not paused
    if (!audio.paused) {
      Logger.info(`Track ${index + 1} is playing successfully`);
      // Reset consecutive errors since we have a successful playback
      this._consecutiveErrors = 0;
    } else {
      // Audio is paused - check if it has a valid source and is just loading
      if (audio.src && !audio.src.includes('blob:') && !audio.src.includes('track_id=&')) {
        Logger.info(`Track ${index + 1} has valid source, waiting for playback to start`);
        // Check again after a short delay in case it's still loading
        setTimeout(() => {
          if (!audio.paused) {
            Logger.info(`Track ${index + 1} started playing after delay`);
            this._consecutiveErrors = 0;
          } else {
            Logger.warn(`Track ${index + 1} failed to play automatically`);
            this._consecutiveErrors++;
            
            // If we've tried a few times and it's still not playing, move to the next track
            if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
              Logger.warn(`Track ${index + 1} failed ${this._consecutiveErrors} times, skipping to next track`);
              // Add a delay before skipping to avoid race conditions
              setTimeout(() => {
                this.playNextWishlistTrack();
              }, 1000);
            }
          }
        }, 2000);
      } else {
        // The source is invalid
        Logger.warn(`Track ${index + 1} has invalid source: ${audio.src}`);
        this._consecutiveErrors++;
        
        // Try to fix the URL if it's missing the track ID
        if (audio.src.includes('track_id=&') || !audio.src.includes('track_id=')) {
          const currentItem = this._wishlistItems[index];
          if (currentItem) {
            const trackId = currentItem.getAttribute('data-track-id');
            if (trackId) {
              Logger.info(`[Bandcamp+] Detected stream URL with missing track ID: ${audio.src}`);
              Logger.info(`[Bandcamp+] Found track ID from collection item: ${trackId}`);
              
              // Update the URL with the track ID
              try {
                const urlParts = audio.src.split('?');
                const baseUrl = urlParts[0];
                const params = new URLSearchParams(urlParts.length > 1 ? urlParts[1] : '');
                
                // Set the track ID and update timestamp
                params.set('track_id', trackId);
                const timestamp = Math.floor(Date.now() / 1000);
                params.set('ts', timestamp.toString());
                
                // Create the fixed URL
                const fixedUrl = `${baseUrl}?${params.toString()}`;
                Logger.info(`[Bandcamp+] Fixed stream URL: ${fixedUrl}`);
                
                // Set the new URL and try to play
                audio.src = fixedUrl;
                audio.load();
                audio.play().catch(e => {
                  Logger.warn(`[Bandcamp+] Error playing fixed audio: ${e.message}`);
                  // If it still fails, skip to next track
                  setTimeout(() => {
                    this.playNextWishlistTrack();
                  }, 1000);
                });
              } catch (error) {
                Logger.error('Error fixing stream URL:', error);
                // Move to the next track
                setTimeout(() => {
                  this.playNextWishlistTrack();
                }, 1000);
              }
            } else {
              Logger.warn(`No track ID available for item ${index}, trying next track`);
              setTimeout(() => {
                this.playNextWishlistTrack();
              }, 1000);
            }
          } else {
            Logger.warn(`No wishlist item found at index ${index}, trying next track`);
            setTimeout(() => {
              this.playNextWishlistTrack();
            }, 1000);
          }
        } else {
          // URL appears correct but audio isn't playing, skip to next track
          setTimeout(() => {
            this.playNextWishlistTrack();
          }, 1000);
        }
      }
    }
  }
  
  /**
   * Handle the loadstart event for the audio element
   * Used to catch and fix missing track IDs before they cause errors
   */
  private static handleAudioLoadStart = (event: Event) => {
    const audio = event.target as HTMLAudioElement;
    
    // Check if we're on a wishlist page and have a source with missing track ID
    if (BandcampFacade.isWishlistPage && 
        BandcampFacade._currentWishlistIndex >= 0 &&
        audio.src && 
        (audio.src.includes('track_id=&') || !audio.src.includes('track_id='))) {
      
      Logger.info('[Bandcamp+] Detected stream URL with missing track ID:', audio.src);
      
      // Get the current item
      const currentItem = BandcampFacade._wishlistItems[BandcampFacade._currentWishlistIndex];
      if (currentItem) {
        // Try to get the track ID
        const trackId = currentItem.getAttribute('data-track-id');
        if (trackId) {
          // Check if it's a known problematic track ID (like 3302866485)
          if (BandcampFacade._problemTrackIds.has(trackId) || trackId === '3302866485') {
            Logger.info(`[Bandcamp+] Detected known problematic track ID: ${trackId}, skipping track`);
            // Add to problem track IDs if not already there
            if (!BandcampFacade._problemTrackIds.has(trackId)) {
              BandcampFacade._problemTrackIds.add(trackId);
            }
            
            // Pause the audio to prevent further error events
            audio.pause();
            
            // Set a flag to indicate we're skipping this track
            BandcampFacade._skipInProgress = true;
            
            // Skip to next track with a delay to ensure page has time to register the change
            setTimeout(() => {
              BandcampFacade._skipInProgress = false;
              BandcampFacade._errorRecoveryInProgress = false;
              if (BandcampFacade.isWishlistPage) {
                BandcampFacade.playNextWishlistTrack();
              }
            }, 500);
            return;
          }
          
          Logger.info('[Bandcamp+] Found track ID from collection item:', trackId);
          
          // Update the URL with the track ID
          try {
            const urlParts = audio.src.split('?');
            const baseUrl = urlParts[0];
            const params = new URLSearchParams(urlParts.length > 1 ? urlParts[1] : '');
            
            // Set the track ID and update timestamp
            params.set('track_id', trackId);
            const timestamp = Math.floor(Date.now() / 1000);
            params.set('ts', timestamp.toString());
            
            // Create the fixed URL
            const fixedUrl = `${baseUrl}?${params.toString()}`;
            Logger.info('[Bandcamp+] Fixed stream URL:', fixedUrl);
            
            // Set the new URL and try to play
            audio.src = fixedUrl;
            audio.load();
            audio.play().catch(e => {
              Logger.warn('[Bandcamp+] Error playing fixed audio:', e);
              
              // Check if this is a 404 error or media format error
              if (e.name === 'NotSupportedError' || 
                 (typeof e === 'object' && e.message && e.message.includes('404'))) {
                Logger.info('[Bandcamp+] Track may be unavailable (404/NotSupported), adding to problem list');
                BandcampFacade._problemTrackIds.add(trackId);
                
                // Move to next track directly
                setTimeout(() => {
                  BandcampFacade.playNextWishlistTrack();
                }, 500);
              } else {
                // For other errors, try a completely different URL format as last resort
                try {
                  const directStreamUrl = `https://bandcamp.com/stream_redirect?enc=mp3-128&track_id=${trackId}&ts=${timestamp}`;
                  Logger.info('[Bandcamp+] Trying direct stream URL as last resort:', directStreamUrl);
                  
                  audio.src = directStreamUrl;
                  audio.load();
                  audio.play().catch(directError => {
                    Logger.warn('[Bandcamp+] Direct stream URL also failed:', directError);
                    
                    // Give up and move to next track
                    setTimeout(() => {
                      BandcampFacade.playNextWishlistTrack();
                    }, 500);
                  });
                } catch (directUrlError) {
                  Logger.error('[Bandcamp+] Error creating direct stream URL:', directUrlError);
                  setTimeout(() => {
                    BandcampFacade.playNextWishlistTrack();
                  }, 500);
                }
              }
            });              } catch (error) {
                ErrorHandler.withErrorHandling(() => { throw error; }, 'Error fixing stream URL');
                
                // Move to the next trackif we encounter an error
            setTimeout(() => {
              BandcampFacade.playNextWishlistTrack();
            }, 500);
          }
        } else {
          Logger.warn('[Bandcamp+] No track ID available for current item, trying next track');
          setTimeout(() => {
            BandcampFacade.playNextWishlistTrack();
          }, 500);
        }
      } else {
        Logger.warn('[Bandcamp+] No current wishlist item found, trying next track');
        setTimeout(() => {
          BandcampFacade.playNextWishlistTrack();
        }, 500);
      }
    }
  }

  /**
   * Click the buy button on the current page
   */
  public static clickBuyButtonOnCurrentPage(): void {
    BuyUtils.clickBuyButtonOnCurrentPage();
  }

  /**
   * Buy the current track
   */
  public static buyCurrentTrack(): void {
    // Special handling for wishlist pages
    if (this.isWishlistPage) {
      // If we have wishlist items but no track is currently playing (index is -1)
      // Simply do nothing as requested
      if (this._currentWishlistIndex < 0) {
        Logger.info('C key detected - no track selected, ignoring press');
        return;
      }
      
      // Handle case where a track is currently playing (_currentWishlistIndex >= 0)
      if (this._wishlistItems.length > 0) {
        const currentItem = this._wishlistItems[this._currentWishlistIndex];
        if (currentItem) {
          Logger.info('C key detected - buying current track from wishlist');
          
          // First priority: Check the now-playing section which has accurate links for the current track
          const nowPlaying = document.querySelector('.now-playing');
          if (nowPlaying) {
            Logger.info('Found now-playing section, checking for direct buy links');
            
            // Look for the buy-now link in the now-playing section which should point to the individual track
            const nowPlayingBuyLink = BuyUtils.findBuyLinkInContainer(nowPlaying as HTMLElement);
            if (nowPlayingBuyLink) {
              Logger.info('Found buy now link in now-playing section, using this');
              const href = (nowPlayingBuyLink as HTMLAnchorElement).href;
              BuyUtils.openBuyLinkWithCart(href);
              return;
            }
            
            // If no buy link, try the track URL from the title
            const nowPlayingTrackLink = nowPlaying.querySelector('.title');
            if (nowPlayingTrackLink) {
              const trackLinkParent = nowPlayingTrackLink.closest('a');
              if (trackLinkParent) {
                Logger.info('Found track link in now-playing section, using this instead');
                const href = (trackLinkParent as HTMLAnchorElement).href;
                BuyUtils.openBuyLinkWithCart(href);
                return;
              }
            }
          }
          
          // Look for buy links in the current item
          const buyLink = BuyUtils.findBuyLinkInContainer(currentItem);
          
          if (buyLink) {
            Logger.info('Found buy link, opening it in new tab');
            const href = (buyLink as HTMLAnchorElement).href;
            BuyUtils.openBuyLinkWithCart(href);
            return;
          }
          
          // If no direct buy link in the item, try to find the track/album URL
          // Prioritize track links over album links
          const trackLink = DOMSelectors.findOneWithSelectors<HTMLAnchorElement>(DOMSelectors.ALBUM_TRACK_LINKS, currentItem);
          
          if (trackLink) {
            // Get the href and add add_to_cart parameter
            const href = (trackLink as HTMLAnchorElement).href;
            Logger.info('Opening track page with add_to_cart parameter in new tab:', href);
            BuyUtils.openBuyLinkWithCart(href);
            return;
          }
          
          // If we can't find a track/album link, try to extract it from data attributes
          const trackUrl = currentItem.getAttribute('data-track-url') || 
                          currentItem.getAttribute('data-album-url') || 
                          currentItem.getAttribute('data-track-href');
          if (trackUrl) {
            Logger.info('Opening track URL from data attribute with add_to_cart parameter in new tab:', trackUrl);
            BuyUtils.openBuyLinkWithCart(trackUrl);
            return;
          }
          
          // Last attempt - look for any link that might lead to the track page
          const anyLink = currentItem.querySelector('a:not([href*="javascript"])');
          if (anyLink) {
            const href = (anyLink as HTMLAnchorElement).href;
            if (href && (href.includes('bandcamp.com') || href.startsWith('/'))) {
              Logger.info('Opening potentially related page with add_to_cart parameter in new tab:', href);
              BuyUtils.openBuyLinkWithCart(href);
              return;
            }
          }
          
          Logger.warn('Could not find any suitable link to the track page in the current wishlist item');
        } else {
          Logger.warn('Current wishlist item not found');
        }
      } else {
        Logger.warn('No wishlist items loaded');
      }
    } else if (this.isAlbum) {
      // Special handling for album pages - buy the currently playing track, not the entire album
      Logger.info('C key detected on album page - looking for currently playing track');
      
      // Find the currently playing track row (has 'current_track' class)
      const currentTrackRow = document.querySelector('.track_row_view.current_track');
      
      if (currentTrackRow) {
        Logger.info('Found currently playing track row, looking for track link');
        
        // Look for the track link within the current track row
        const trackLink = currentTrackRow.querySelector('.title a') as HTMLAnchorElement;
        
        if (trackLink && trackLink.href) {
          Logger.info('Found track link for currently playing track, opening with cart parameter:', trackLink.href);
          BuyUtils.openBuyLinkWithCart(trackLink.href);
          return;
        } else {
          Logger.warn('Could not find track link in currently playing track row');
        }
      } else {
        Logger.info('No track currently playing on album page, buying entire album instead');
      }
      
      // Fallback: buy the entire album if no specific track is playing
      this.clickBuyButtonOnCurrentPage();
    } else if (this.isTrack) {
      // For individual track pages, click the buy button directly to open buy dialog
      Logger.info('C key detected on track page - clicking buy button to open buy dialog');
      this.clickBuyButtonOnCurrentPage();
    } else {
      // Fallback for other page types
      Logger.info('C key detected on unsupported page type - attempting default buy action');
      this.clickBuyButtonOnCurrentPage();
    }
  }

  // Add a debounce flag to prevent rapid play/pause toggling
  private static _playPauseInProgress = false;

  /**
   * Toggle play/pause for the current audio
   */
  public static togglePlayPause(): void {
    try {
      // Check if toggle is already in progress to prevent rapid toggling
      if (this._playPauseInProgress) {
        Logger.info('Play/pause toggle already in progress, ignoring request');
        return;
      }

      // Set the flag to indicate a toggle is in progress
      this._playPauseInProgress = true;

      // Special handling for wishlist pages
      if (this.isWishlistPage) {
        // Check if we need to start playback for the first time (no track selected yet)
        if (this._currentWishlistIndex < 0 && this._wishlistItems.length === 0) {
          Logger.info('Loading wishlist items for first-time playback');
          this.loadWishlistItems();
        }
        
        if (this._currentWishlistIndex < 0 && this._wishlistItems.length > 0) {
          Logger.info('No track currently selected on wishlist page, starting from first track');
          // Clear the flag before starting a new track to avoid lockout
          this._playPauseInProgress = false;
          this.startWishlistPlayback();
          return;
        }
        
        const wishlistAudio = AudioUtils.getWishlistAudioElement();
        
        if (wishlistAudio) {
          // Toggle play/pause state
          if ((wishlistAudio as HTMLAudioElement).paused) {
            Logger.info('Playing audio on wishlist page');
            (wishlistAudio as HTMLAudioElement).play()
              .then(() => {
                // Clear the flag after successful play
                setTimeout(() => {
                  this._playPauseInProgress = false;
                }, 300);
              })
              .catch(e => {
                ErrorHandler.withErrorHandling(() => { throw e; }, 'Error playing audio');
                // Clear the flag even if there's an error
                this._playPauseInProgress = false;
              });
          } else {
            Logger.info('Pausing audio on wishlist page');
            (wishlistAudio as HTMLAudioElement).pause();
            // Clear the flag after a short delay for pausing
            setTimeout(() => {
              this._playPauseInProgress = false;
            }, 300);
          }
          
          // Also try to find and update UI play button if it exists
          const playButton = document.querySelector('.carousel-player-inner .playbutton, .play-button');
          if (playButton && playButton.classList) {
            if ((wishlistAudio as HTMLAudioElement).paused) {
              playButton.classList.remove('playing');
            } else {
              playButton.classList.add('playing');
            }
          }
          
          return;
        }
      }
      
      // Standard handling for regular Bandcamp pages
      const playButton = this.getPlay();
      if (playButton) {
        Logger.info('Clicking play button to toggle play/pause');
        playButton.click();
        // Clear the flag after a short delay for button click
        setTimeout(() => {
          this._playPauseInProgress = false;
        }, 300);
      } else {
        // Try direct audio control as fallback
        const audio = this.audio || AudioUtils.getAudioElement();
        if (audio) {
          if (audio.paused) {
            Logger.info('Playing audio directly');
            audio.play()
              .then(() => {
                // Clear the flag after successful play
                setTimeout(() => {
                  this._playPauseInProgress = false;
                }, 300);
              })
              .catch(e => {
                Logger.error('Error playing audio:', e);
                // Clear the flag even if there's an error
                this._playPauseInProgress = false;
              });
          } else {
            Logger.info('Pausing audio directly');
            audio.pause();
            // Clear the flag after a short delay for pausing
            setTimeout(() => {
              this._playPauseInProgress = false;
            }, 300);
          }
        } else {
          Logger.warn('No play button or audio element found for toggle play/pause');
          // Clear the flag immediately if we couldn't find anything to toggle
          this._playPauseInProgress = false;
        }
      }
    } catch (error) {
      Logger.error('Error in togglePlayPause:', error);
      // Make sure to clear the flag even if there's an error
      this._playPauseInProgress = false;
    }
  }

  /**
   * Toggle wishlist status for the currently playing track in the wishlist
   */
  public static toggleCurrentTrackWishlist(): void {
    if (!this.isWishlistPage || this._currentWishlistIndex < 0 || !this._wishlistItems.length) {
      Logger.warn('Cannot toggle current track wishlist - not on wishlist page or no track selected');
      return;
    }

    try {
      // Get the current wishlist item
      const currentItem = this._wishlistItems[this._currentWishlistIndex];
      if (!currentItem) {
        Logger.warn('Current wishlist item not found');
        return;
      }
      
      // Extract track information using centralized service
      const trackInfo = WishlistService.extractTrackInfo(currentItem);
      
      if (trackInfo.trackId) {
        Logger.info(`Found track ID ${trackInfo.trackId} for wishlist toggle`);
        
        // First try to use direct API to toggle wishlist status
        const pageData = document.getElementById('pagedata');
        if (pageData) {
          const dataBlob = pageData.getAttribute('data-blob');
          if (dataBlob) {
            try {
              const data = JSON.parse(dataBlob);
              const fanId = data.fan_id || (data.fan_tralbum_data && data.fan_tralbum_data.fan_id);
              
              if (fanId) {
                Logger.info(`Found fan ID: ${fanId}, attempting to toggle wishlist via API`);
                
                // Use centralized API method - since we're on wishlist page, we want to remove
                WishlistService.toggleWishlistViaAPI(trackInfo.trackId, fanId.toString(), trackInfo.itemType, true)
                  .then((success: boolean) => {
                    if (success) {
                      Logger.info('Successfully toggled wishlist status via API!');
                      
                      // Update UI - hide or remove the item since we're on the wishlist page
                      currentItem.style.opacity = '0.5';
                      currentItem.style.transition = 'opacity 0.3s';
                      setTimeout(() => {
                        // Either remove from DOM or hide
                        if (currentItem.parentElement) {
                          currentItem.parentElement.removeChild(currentItem);
                          // Update the wishlist items array
                          this._wishlistItems = this._wishlistItems.filter(item => item !== currentItem);
                        } else {
                          currentItem.style.display = 'none';
                        }
                      }, 300);
                      
                      return;
                    } else {
                      // Fall back to UI clicking
                      this.fallbackToWishlistButtonClick(currentItem);
                    }
                  })
                  .catch((error: any) => {
                    Logger.error('Error toggling wishlist via API:', error);
                    // Fall back to UI clicking
                    this.fallbackToWishlistButtonClick(currentItem);
                  });
                
                return;
              }
            } catch (parseError) {
              Logger.error('Error parsing page data:', parseError);
            }
          }
        }
      }
      
      // If we couldn't use the API approach, fall back to clicking UI elements
      this.fallbackToWishlistButtonClick(currentItem);
      
    } catch (error) {
      Logger.error('Error toggling current track wishlist:', error);
    }
  }
  
  /**
   * Fallback method to find and click wishlist button in the UI
   * @param currentItem The current wishlist item element
   */
  private static fallbackToWishlistButtonClick(currentItem: HTMLElement): void {
    Logger.info('Falling back to wishlist button click method');
    
    try {
      // Use centralized wishlist service to click UI buttons
      const success = WishlistService.clickWishlistToggleInUI(currentItem);
      
      if (success) {
        // Update UI after a short delay using centralized service
        setTimeout(() => {
          WishlistService.updateWishlistIcons(currentItem, false);
        }, 500);
        
        return;
      }
      
      // If UI clicking failed, try navigation as last resort
      const navigationSuccess = WishlistService.navigateToTrackForWishlistToggle(currentItem, this._currentWishlistIndex);
      
      if (!navigationSuccess) {
        Logger.warn('Could not find any wishlist toggle or track link for the current track');
      }
    } catch (error) {
      Logger.error('Error in fallbackToWishlistButtonClick:', error);
    }
  }
  
  /**
   * Helper method to update wishlist icons without removing the item
   * @param item The wishlist item to update
   * @param isInWishlist Whether the item is in the wishlist or not
   */
  private static updateWishlistIcons(item: HTMLElement, isInWishlist: boolean): void {
    // Use centralized wishlist service
    WishlistService.updateWishlistIcons(item, isInWishlist);
  }
  
  /**
   * Helper method to handle wishlist item removal UI updates
   * @param item The wishlist item to update UI for
   */
  private static handleWishlistItemRemoval(item: HTMLElement): void {
    Logger.info('Updating wishlist UI state (not removing item)');
    
    // Just update the wishlist icons instead of removing the item
    this.updateWishlistIcons(item, false);
  }

  /**
   * Load more discovery items from the Bandcamp discovery page
   * @returns Promise that resolves to true if more items were loaded
   */
  public static async loadMoreDiscoveryItems(): Promise<boolean> {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot load more items');
      return false;
    }

    try {
      Logger.info('Loading more discovery items');
      
      // Look for the "load more" button on the discovery page
      const loadMoreButton = document.querySelector('.show-more button, button.show-more, [data-bind*="loadMore"]');
      
      if (loadMoreButton) {
        Logger.info('Found load more button, clicking it');
        (loadMoreButton as HTMLElement).click();
        
        // Wait for items to load
        return new Promise<boolean>((resolve) => {
          // Check if new items have been added after a short delay
          setTimeout(() => {
            const currentItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.DISCOVERY_ITEMS);
            Logger.info(`Found ${currentItems.length} discovery items after loading more`);
            resolve(true);
          }, 2000);
        });
      } else {
        Logger.warn('No load more button found on discovery page');
        return false;
      }
    } catch (error) {
      Logger.error('Error loading more discovery items:', error);
      return false;
    }
  }

  /**
   * Get all discovery items from the current discovery page
   * @returns Array of discovery item elements
   */
  public static getDiscoveryItems(): HTMLElement[] {
    if (!window.location.href.includes('/discover')) {
      return [];
    }

    try {
      // Try different selectors for discovery items
      const discoveryItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.DISCOVERY_ITEMS);
      
      if (discoveryItems.length > 0) {
        Logger.info(`Found ${discoveryItems.length} discovery items`);
      }
      
      if (discoveryItems.length === 0) {
        Logger.warn('No discovery items found');
      }
      
      return discoveryItems;
    } catch (error) {
      Logger.error('Error getting discovery items:', error);
      return [];
    }
  }

  /**
   * Get featured discovery items from the current discovery page
   * @returns Array of featured discovery item elements
   */
  public static getFeaturedDiscoveryItems(): HTMLElement[] {
    if (!window.location.href.includes('/discover')) {
      return [];
    }

    try {
      // Try different selectors for featured discovery items
      const items = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.FEATURED_DISCOVERY_ITEMS);
      
      if (items.length > 0) {
        Logger.info(`Found ${items.length} featured discovery items`);
        return items;
      }
      
      Logger.warn('No featured discovery items found');
      return [];
    } catch (error) {
      Logger.error('Error getting featured discovery items:', error);
      return [];
    }
  }

  /**
   * Click on a discovery item by its index
   * @param index The index of the discovery item to click
   * @returns True if successful, false otherwise
   */
  public static clickDiscoveryItem(index: number): boolean {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot click discovery item');
      return false;
    }
    
    try {
      const discoveryItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.DISCOVERY_ITEMS);
      
      if (!discoveryItems || discoveryItems.length === 0) {
        Logger.warn('No discovery items found on page');
        return false;
      }
      
           if (index < 0 || index >= discoveryItems.length) {
        Logger.warn(`Invalid discovery item index: ${index}. Available range: 0-${discoveryItems.length - 1}`);
        return false;
      }
      
      const item = discoveryItems[index] as HTMLElement;
      item.click();
      
      Logger.info(`Clicked on discovery item at index ${index}`);
      return true;
    } catch (error) {
      Logger.error('Error clicking discovery item:', error);
      return false;
    }
  }
  
  /**
   * Click on a featured discovery item by its index
   * @param index The index of the featured discovery item to click
   *   * @returns True if successful, false otherwise
   */
  public static clickFeaturedDiscoveryItem(index: number): boolean {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot click featured discovery item');
      return false;
    }
    
    try {
      const featuredItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.FEATURED_DISCOVERY_ITEMS);
      
      if (!featuredItems || featuredItems.length === 0) {
        Logger.warn('No featured discovery items found on page');
        return false;
      }
      
      if (index < 0 || index >= featuredItems.length) {
        Logger.warn(`Invalid featured item index: ${index}. Available range: 0-${featuredItems.length - 1}`);
        return false;
      }
      
      const item = featuredItems[index] as HTMLElement;
      item.click();
      
      Logger.info(`Clicked on featured discovery item at index ${index}`);
      return true;
    } catch (error) {
      Logger.error('Error clicking featured discovery item:', error);
      return false;
    }
  }
  
  /**
   * Get the available discovery filters
   * @returns An object containing the available filters
   */
  public static getDiscoveryFilters(): Record<string, any> {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot get discovery filters');
      return {};
    }
    
    try {
      const filters: Record<string, any> = {};
      
      // Get genre filters
      const genreSelector = document.querySelector('.genre-selector, #genre-selector, [data-bind*="genre"]');
      if (genreSelector) {
        filters.genres = Array.from(genreSelector.querySelectorAll('option, li, a')).map(option => {
          return {
            value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
            label: option.textContent?.trim()
          };
        });
      }
      
      // Get subgenre filters
      const subgenreSelector = document.querySelector('.subgenre-selector, #subgenre-selector, [data-bind*="subgenre"]');
      if (subgenreSelector) {
        filters.subgenres = Array.from(subgenreSelector.querySelectorAll('option, li, a')).map(option => {
          return {
            value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
            label: option.textContent?.trim()
          };
        });
      }
      
      // Get format filters
      const formatSelector = document.querySelector('.format-selector, #format-selector, [data-bind*="format"]');
      if (formatSelector) {
        filters.formats = Array.from(formatSelector.querySelectorAll('option, li, a')).map(option => {
          return {
            value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
            label: option.textContent?.trim()
          };
        });
      }
      
      // Get location filters
      const locationSelector = document.querySelector('.location-selector, #location-selector, [data-bind*="location"]');
      if (locationSelector) {
        filters.locations = Array.from(locationSelector.querySelectorAll('option, li, a')).map(option => {
          return {
            value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
            label: option.textContent?.trim()
          };
        });
      }
      
      // Get time filters
      const timeSelector = document.querySelector('.time-selector, #time-selector, [data-bind*="time"]');
      if (timeSelector) {
        filters.times = Array.from(timeSelector.querySelectorAll('option, li, a')).map(option => {
          return {
            value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
            label: option.textContent?.trim()
          };
        });
      }
      
      return filters;
    } catch (error) {
      Logger.error('Error getting discovery filters:', error);
      return {};
    }
  }
  
  /**
   * Apply a filter to the discovery page
   * @param filterType The type of filter to apply (genre, subgenre, format, location, time)
   * @param value The value to set for the filter
   * @returns True if the filter was applied successfully
   */
  public static applyDiscoveryFilter(filterType: string, value: string): boolean {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot apply discovery filter');
      return false;
    }

    try {
      // Map filter type to selector
      const selectorMap: Record<string, string> = {
        genre: '.genre-selector, #genre-selector, [data-bind*="genre"]',
        subgenre: '.subgenre-selector, #subgenre-selector, [data-bind*="subgenre"]',
        format: '.format-selector, #format-selector, [data-bind*="format"]',
        location: '.location-selector, #location-selector, [data-bind*="location"]',
        time: '.time-selector, #time-selector, [data-bind*="time"]'
      };
      
      const selector = selectorMap[filterType.toLowerCase()];
      if (!selector) {
        Logger.warn(`Unknown filter type: ${filterType}`);
        return false;
      }
      
      // Find the filter element
      const filterElement = document.querySelector(selector);
      if (!filterElement) {
        Logger.warn(`Filter element not found for filter type: ${filterType}`);
        return false;
      }
      
      // Check if it's a select element
      if (filterElement.tagName === 'SELECT') {
        const selectElement = filterElement as HTMLSelectElement;
        selectElement.value = value;
        
        // Trigger change event
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
        
        Logger.info(`Applied ${filterType} filter with value: ${value}`);
        return true;
      }
      
      // Check if it's a list of options
      const options = filterElement.querySelectorAll('option, li, a');
      for (const option of Array.from(options)) {
        const optionValue = option.getAttribute('value') || 
                           option.getAttribute('data-value') || 
                           option.textContent;
        
        if (optionValue === value || option.textContent === value) {
          (option as HTMLElement).click();
          Logger.info(`Applied ${filterType} filter with value: ${value}`);
          return true;
        }
      }
      
      Logger.warn(`Could not find option with value ${value} for filter type ${filterType}`);
      return false;
    } catch (error) {
      Logger.error('Error applying discovery filter:', error);
      return false;
    }
  }
  
  /**
   * Save the current discovery page preferences with a name
   * @param name The name to save the preferences under
   * @returns True if saved successfully
   */
  public static saveDiscoveryPreference(name: string): boolean {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot save discovery preferences');
      return false;
    }
    
    try {
      // Get current URL which contains all filter parameters
      const currentUrl = window.location.href;
      
      // Get existing preferences
      const existingPreferencesString = localStorage.getItem('bandcampPlusDiscoveryPreferences');
      let preferences: Record<string, string> = {};
      
      if (existingPreferencesString) {
        try {
          preferences = JSON.parse(existingPreferencesString);
        } catch (error) {
          Logger.error('Error parsing existing preferences:', error);
          preferences = {};
        }
      }
      
      // Save the new preference
      preferences[name] = currentUrl;
      
      // Save back to localStorage
      localStorage.setItem('bandcampPlusDiscoveryPreferences', JSON.stringify(preferences));
      
      Logger.info(`Saved discovery preference '${name}' with URL: ${currentUrl}`);
      return true;
    } catch (error) {
      Logger.error('Error saving discovery preference:', error);
      return false;
    }
  }
  
  /**
   * Load a saved discovery preference by name
   * @param name The name of the preference to load
   * @returns True if loaded successfully
   */
  public static async loadDiscoveryPreference(name: string): Promise<boolean> {
    try {
      // Get existing preferences
      const existingPreferencesString = localStorage.getItem('bandcampPlusDiscoveryPreferences');
      
      if (!existingPreferencesString) {
        Logger.warn('No saved discovery preferences found');
        return false;
      }
      
      let preferences: Record<string, string>;
      
      try {
        preferences = JSON.parse(existingPreferencesString);
      } catch (error) {
        Logger.error('Error parsing discovery preferences:', error);
        return false;
      }
      
      const savedUrl = preferences[name];
      
      if (!savedUrl) {
        Logger.warn(`No discovery preference found with name: ${name}`);
        return false;
      }
      
      // Navigate to the saved URL
      Logger.info(`Loading discovery preference '${name}' with URL: ${savedUrl}`);
      window.location.href = savedUrl;
      return true;
    } catch (error) {
      Logger.error('Error loading discovery preference:', error);
      return false;
    }
  }
  
  /**
   * Get all stored discovery preferences
   * @returns A record of preference names and their URLs
   */
  public static getStoredDiscoveryPreferences(): Record<string, any> {
    try {
      // Get existing preferences
      const existingPreferencesString = localStorage.getItem('bandcampPlusDiscoveryPreferences');
      
      if (!existingPreferencesString) {
        return {};
      }
      
      try {
        return JSON.parse(existingPreferencesString);
      } catch (error) {
        Logger.error('Error parsing discovery preferences:', error);
        return {};
      }
    } catch (error) {
      Logger.error('Error getting stored discovery preferences:', error);
      return {};
    }
  }
  
  /**
   * Delete a saved discovery preference by name
   * @param name The name of the preference to delete
   * @returns True if deleted successfully
   */
  public static deleteDiscoveryPreference(name: string): boolean {
    try {
      // Get existing preferences
      const existingPreferencesString = localStorage.getItem('bandcampPlusDiscoveryPreferences');
      
      if (!existingPreferencesString) {
        Logger.warn('No saved discovery preferences found');
        return false;
      }
      
      let preferences: Record<string, string>;
      
      try {
        preferences = JSON.parse(existingPreferencesString);
      } catch (error) {
        Logger.error('Error parsing discovery preferences:', error);
        return false;
      }
      
      if (!preferences[name]) {
        Logger.warn(`No discovery preference found with name: ${name}`);
        return false;
      }
      
      // Delete the preference
      delete preferences[name];
      
      // Save back to localStorage
      localStorage.setItem('bandcampPlusDiscoveryPreferences', JSON.stringify(preferences));
      
      Logger.info(`Deleted discovery preference: ${name}`);
      return true;
    } catch (error) {
      Logger.error('Error deleting discovery preference:', error);
      return false;
    }
  }
  
  /**
   * Navigate to the Bandcamp discovery page
   * @returns True if navigation was initiated successfully
   */
  public static navigateToDiscovery(): boolean {
    try {
      window.location.href = 'https://bandcamp.com/discover';
      return true;
    } catch (error) {
      Logger.error('Error navigating to discovery page:', error);
      return false;
    }
  }

  /**
   * Load all wishlist items by clicking the "view all items" button
   * @returns Promise that resolves to true if all items were loaded successfully
   */
  public static async loadAllWishlistItems(): Promise<boolean> {
    if (!this.isWishlistPage) {
      Logger.warn('Not on wishlist page, cannot load all items');
      return false;
    }

    try {
      Logger.info('Checking if all wishlist items need to be loaded...');
      
      // Try to get the number of items expected from the tab counts
      const tabCounts: Record<string, number> = {};
      const tabs = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.TABS);
      
      tabs.forEach(tab => {
        const countElement = tab.querySelector('.count');
        if (countElement) {
          const tabName = tab.getAttribute('data-tab') || 
                         tab.className.toLowerCase().replace('active', '').trim() ||
                         tab.textContent?.toLowerCase().trim().replace(/[^a-z]/g, '');
          
          const count = parseInt(countElement.textContent || '0', 10);
          if (!isNaN(count)) {
            tabCounts[tabName] = count;
            Logger.info(`Tab "${tabName}" has count: ${count}`);
          }
        }
      });
      
      // Get the expected wishlist count
      let wishlistCount = tabCounts['wishlist'] || 0;
      Logger.info(`Expected wishlist count: ${wishlistCount}`);
      
      // Check if we already have all items loaded
      const currentItems = this.loadWishlistItems();
      Logger.info(`Currently loaded items: ${currentItems.length}`);
      
      if (currentItems.length >= wishlistCount && wishlistCount > 0) {
        Logger.info('All wishlist items already loaded, no need to click "view all"');
        return true;
      }
      
      Logger.info('Need to load more items, looking for "view all" button...');
      
      // Look for "show-more" buttons
      const showMoreButtons = Array.from(document.getElementsByClassName('show-more')) as HTMLElement[];
      Logger.info(`Found ${showMoreButtons.length} buttons with class="show-more"`);
      
      // First check if we're already on the wishlist tab
      const isWishlistTabActive = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.ACTIVE_WISHLIST_TAB) !== null;
      Logger.info(`Wishlist tab active: ${isWishlistTabActive}`);
      
      // Find buttons with "view all X items" text
      const itemButtons = showMoreButtons.filter(button => {
        const text = button.textContent?.trim().toLowerCase() || '';
        return /^view all \d+ items?$/.test(text);
      });
      
      Logger.info(`Found ${itemButtons.length} buttons with "view all X items" text`);
      
      // Extract counts from button text for sorting
      const buttonDetails = itemButtons.map(button => {
        const text = button.textContent?.trim().toLowerCase() || '';
        const match = text.match(/view all (\d+) items?/);
        const count = match ? parseInt(match[1], 10) : 0;
        
        return { button, count, text };
      });
      
      Logger.info('Available item buttons:');
      buttonDetails.forEach(details => {
        Logger.info(`- "${details.text}" (count: ${details.count})`);
      });
      
      // Match button with the count that matches the wishlist tab count
      let wishlistButton = buttonDetails.find(details => details.count === wishlistCount)?.button;
      
      // If we couldn't find a matching button by count, try other approaches
      if (!wishlistButton && buttonDetails.length > 1) {
        Logger.info('Could not find button with count matching wishlist tab, using position approach');
        
        // On typical Bandcamp profiles, the tabs are: collection, wishlist, followers, following
        // So the second "items" button should be for wishlist if there are two
        if (buttonDetails.length >= 2) {
          // Sort buttons by their numeric count
          const buttonsByCount = showMoreButtons.filter(button => {
            const text = button.textContent?.trim().toLowerCase() || '';
            return /^view all \d+ items?$/.test(text);
          }).map(button => {
            const text = button.textContent?.trim().toLowerCase() || '';
            const match = text.match(/view all (\d+) items?/);
            const count = match ? parseInt(match[1], 10) : 999999;
            return { button, count };
          }).sort((a, b) => a.count - b.count);
          
          // Log the buttons sorted by count
          Logger.info('Buttons sorted by count:');
          buttonsByCount.forEach(({ button, count }) => {
            Logger.info(`  "${button.textContent?.trim()}" - count: ${count}`);
          });
          
          // Take the button with the smallest count - which should be the wishlist count
          if (buttonsByCount.length > 0) {
            wishlistButton = buttonsByCount[0].button;
            Logger.info(`Selected wishlist button by count: "${wishlistButton.textContent?.trim()}"`);
          }
        } else if (buttonDetails.length === 1) {
          // If there's only one button, use it
          wishlistButton = buttonDetails[0].button;
          Logger.info(`Only one 'items' button found, using it: "${wishlistButton.textContent?.trim()}"`);
        }
      } else if (wishlistButton) {
        Logger.info(`Found wishlist button by matching tab count: "${wishlistButton.textContent?.trim()}"`);
      }
      
      if (!wishlistButton) {
        Logger.warn('Could not determine which button is for the wishlist');
        return false;
      }
      
      Logger.info(`Clicking wishlist button: "${wishlistButton.textContent?.trim()}"`);
      
      // Save the current scroll position
      const originalScrollPosition = window.scrollY;
      
      // Click the wishlist "view all items" button
      try {
        wishlistButton.click();
        Logger.info('Clicked wishlist "view all items" button');
        
        // Wait for content to load and verify we get the expected count
        let attempts = 0;
        const maxAttempts = 20; // Maximum 20 attempts
        let items: HTMLElement[] = [];
        
        while (attempts < maxAttempts) {
          attempts++;
          
          // Trigger lazy loading by scrolling to bottom and staying there longer
          if (attempts <= 15) { // Scroll for more attempts
            Logger.info(`Scrolling to trigger lazy loading (attempt ${attempts})`);
            
            // Scroll to the very bottom of the page
            const maxScroll = Math.max(
              document.body.scrollHeight,
              document.body.offsetHeight,
              document.documentElement.clientHeight,
              document.documentElement.scrollHeight,
              document.documentElement.offsetHeight
            );
            
            window.scrollTo(0, maxScroll);
            
            // Stay at the bottom longer to ensure lazy loading triggers
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Check if more items loaded while at bottom
            const itemsAtBottom = this.loadWishlistItems();
            Logger.info(`Found ${itemsAtBottom.length} items while at bottom`);
            
            // Scroll back to top
            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 400));
          }
          
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Reload wishlist items and check count
          items = this.loadWishlistItems();
          Logger.info(`Attempt ${attempts}: Found ${items.length} wishlist items (expected: ${wishlistCount})`);
          
          // If we have the expected count or more, we're done
          if (items.length >= wishlistCount) {
            Logger.info(`Successfully loaded all ${items.length} wishlist items`);
            break;
          }
          
          // If this is not the last attempt, log that we're waiting
          if (attempts < maxAttempts) {
            Logger.info(`Still loading items, waiting... (${items.length}/${wishlistCount})`);
          }
        }
        
        // If we still don't have all items, try alternative loading strategies
        if (items.length < wishlistCount) {
          Logger.info(`Still missing items (${items.length}/${wishlistCount}), trying alternative strategies...`);
          
          // Strategy 1: Try scrolling in smaller increments
          for (let i = 0; i < 5 && items.length < wishlistCount; i++) {
            Logger.info(`Alternative strategy 1 - incremental scroll ${i + 1}/5`);
            const scrollStep = document.body.scrollHeight / 4;
            window.scrollTo(0, scrollStep * (i + 1));
            await new Promise(resolve => setTimeout(resolve, 1000));
            items = this.loadWishlistItems();
            Logger.info(`After incremental scroll ${i + 1}: Found ${items.length} items`);
          }
          
          // Strategy 2: Try staying at bottom for extended time
          if (items.length < wishlistCount) {
            Logger.info('Alternative strategy 2 - extended bottom stay');
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Stay 3 seconds
            items = this.loadWishlistItems();
            Logger.info(`After extended bottom stay: Found ${items.length} items`);
          }
          
          // Strategy 3: Try triggering scroll events manually
          if (items.length < wishlistCount) {
            Logger.info('Alternative strategy 3 - manual scroll events');
            window.scrollTo(0, document.body.scrollHeight);
            // Dispatch scroll events to trigger any lazy loading listeners
            window.dispatchEvent(new Event('scroll'));
            document.dispatchEvent(new Event('scroll'));
            await new Promise(resolve => setTimeout(resolve, 2000));
            items = this.loadWishlistItems();
            Logger.info(`After manual scroll events: Found ${items.length} items`);
          }
          
          // Final scroll back to top
          window.scrollTo(0, 0);
        }
        
        // Restore scroll position
        window.scrollTo(0, originalScrollPosition);
        
        Logger.info(`Final result: Loaded ${items.length} wishlist items after clicking "view all items" button`);
        
        // Return true if we got at least the expected count
        return items.length >= wishlistCount;
      } catch (clickError) {
        Logger.warn(`Error clicking wishlist "view all items" button:`, clickError);
        return false;
      }
    } catch (error) {
      Logger.error('Error loading all wishlist items:', error);
      return false;
    }
  }
}
