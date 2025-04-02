import {SEEK_STEP, TIMEOUT} from '../constants';

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
          console.log(`Track ID ${trackId} is in our problem list, skipping it`);
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
        console.log(`Adding track ID ${trackId} to problem list`);
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
    try {
      // Special handling for wishlist pages
      if (this.isWishlistPage) {
        // Find the audio element in the wishlist player
        const wishlistAudio = document.querySelector('.carousel-player-inner audio') || 
                              document.querySelector('audio');
        
        if (wishlistAudio) {
          // Reset the playback position to the beginning - use proper type casting
          (wishlistAudio as HTMLAudioElement).currentTime = 0;
          
          // Update the wishlist player UI if necessary
          const wishlistProgressBar = document.querySelector('.carousel-player-inner .progress-bar') ||
                                     document.querySelector('.carousel-player-inner .progress');
          if (wishlistProgressBar) {
            // Force UI update
            const event = new Event('timeupdate');
            (wishlistAudio as HTMLAudioElement).dispatchEvent(event);
          }
          
          console.log('Seeking to start of track on wishlist player');
          return;
        }
      }
      
      // Standard handling for regular pages
      const audioElement = this.audio || document.querySelector('audio');
      
      if (!audioElement) {
        console.warn('No audio element found for seek reset operation');
        return;
      }
      
      // Reset the playback position to the beginning
      (audioElement as HTMLAudioElement).currentTime = 0;
      
      // For release pages, we may need to also update the UI
      const progressBar = document.querySelector('.progress, .progbar_empty, .progbar_fill');
      if (progressBar) {
        // Force UI update if needed
        const event = new Event('timeupdate');
        (audioElement as HTMLAudioElement).dispatchEvent(event);
      }
      
    } catch (error) {
      console.error('Error in seekReset:', error);
    }
  }

  public static seekForward(): void {
    try {
      // Special handling for wishlist pages
      if (this.isWishlistPage) {
        const wishlistAudio = document.querySelector('.carousel-player-inner audio') || 
                              document.querySelector('audio');
        
        if (wishlistAudio) {
          (wishlistAudio as HTMLAudioElement).currentTime += SEEK_STEP;
          
          // Update the wishlist player UI if necessary
          const wishlistProgressBar = document.querySelector('.carousel-player-inner .progress-bar') ||
                                     document.querySelector('.carousel-player-inner .progress');
          if (wishlistProgressBar) {
            const event = new Event('timeupdate');
            (wishlistAudio as HTMLAudioElement).dispatchEvent(event);
          }
          
          return;
        }
      }
      
      // Standard handling for regular pages
      const audioElement = this.audio || document.querySelector('audio');
      
      if (!audioElement) {
        console.warn('No audio element found for seek forward operation');
        return;
      }
      
      // Advance the playback position
      (audioElement as HTMLAudioElement).currentTime += SEEK_STEP;
      
      // For release pages, we may need to also update the UI
      const progressBar = document.querySelector('.progress, .progbar_empty, .progbar_fill');
      if (progressBar) {
        // Force UI update if needed
        const event = new Event('timeupdate');
        (audioElement as HTMLAudioElement).dispatchEvent(event);
      }
      
    } catch (error) {
      console.error('Error in seekForward:', error);
    }
  }

  public static seekBackward(): void {
    try {
      // Special handling for wishlist pages
      if (this.isWishlistPage) {
        const wishlistAudio = document.querySelector('.carousel-player-inner audio') || 
                              document.querySelector('audio');
        
        if (wishlistAudio) {
          (wishlistAudio as HTMLAudioElement).currentTime -= SEEK_STEP;
          
          // Update the wishlist player UI if necessary
          const wishlistProgressBar = document.querySelector('.carousel-player-inner .progress-bar') ||
                                     document.querySelector('.carousel-player-inner .progress');
          if (wishlistProgressBar) {
            const event = new Event('timeupdate');
            (wishlistAudio as HTMLAudioElement).dispatchEvent(event);
          }
          
          return;
        }
      }
      
      // Standard handling for regular pages
      const audioElement = this.audio || document.querySelector('audio');
      
      if (!audioElement) {
        console.warn('No audio element found for seek backward operation');
        return;
      }
      
      // Decrease the playback position
      (audioElement as HTMLAudioElement).currentTime -= SEEK_STEP;
      
      // For release pages, we may need to also update the UI
      const progressBar = document.querySelector('.progress, .progbar_empty, .progbar_fill');
      if (progressBar) {
        // Force UI update if needed
        const event = new Event('timeupdate');
        (audioElement as HTMLAudioElement).dispatchEvent(event);
      }
      
    } catch (error) {
      console.error('Error in seekBackward:', error);
    }
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
      console.log('Attempting to toggle wishlist for entire release');
      
      // Get the collect-item element which is the main container for wishlist functionality
      const collectItem = document.getElementById('collect-item');
      if (!collectItem) {
        console.warn('Could not find collect-item element');
        return;
      }
      
      console.log('Found collect-item with class:', collectItem.className);
      
      // Check if the item is already wishlisted (based on className)
      if (collectItem.classList.contains('wishlisted')) {
        console.log('Item is in wishlist - attempting to remove');
        
        // Try to find the action element within wishlisted-msg that has the remove function
        const removeAction = document.querySelector('#wishlisted-msg .action[title*="Remove"]');
        if (removeAction) {
          console.log('Found remove action element, clicking it directly');
          (removeAction as HTMLElement).click();
          return;
        }
        
        // Try to use the direct link that might be labeled as "In Wishlist"
        const inWishlistLink = document.querySelector('#wishlisted-msg .collect-msg a');
        if (inWishlistLink) {
          console.log('Found In Wishlist link, clicking it');
          (inWishlistLink as HTMLElement).click();
          return;
        }
        
        // Try alternative method to find any element with "Remove" in its title
        const removeElements = Array.from(document.querySelectorAll('[title*="Remove"]'));
        if (removeElements.length > 0) {
          console.log('Found element with Remove in title, clicking it');
          (removeElements[0] as HTMLElement).click();
          return;
        }
        
        // Last resort: try to simulate a proper DOM event on the element
        console.log('Attempting to dispatch custom click event on wishlisted-msg');
        const wishlistedMsg = document.getElementById('wishlisted-msg');
        if (wishlistedMsg) {
          // Create and dispatch a more natural mousedown/mouseup/click sequence
          ['mousedown', 'mouseup', 'click'].forEach(eventType => {
            const event = new MouseEvent(eventType, {
              view: window,
              bubbles: true,
              cancelable: true
            });
            wishlistedMsg.dispatchEvent(event);
          });
          return;
        }
      } else {
        console.log('Item is not in wishlist - attempting to add');
        
        // Find the "Wishlist" button to add to wishlist
        const addButton = document.querySelector('#wishlist-msg a');
        
        if (addButton) {
          console.log('Found add button, clicking it');
          (addButton as HTMLElement).click();
          return;
        }
        
        // Try alternative method to find the add button by container
        const wishlistMsg = document.getElementById('wishlist-msg');
        if (wishlistMsg) {
          console.log('Found wishlist-msg container, clicking it');
          (wishlistMsg as HTMLElement).click();
          return;
        }
        
        // Last resort: find by text content
        const wishlistText = Array.from(document.querySelectorAll('a')).filter(
          a => a.textContent?.trim().toLowerCase() === 'wishlist'
        );
        
        if (wishlistText.length > 0) {
          console.log('Found "Wishlist" text, clicking it');
          (wishlistText[0] as HTMLElement).click();
          return;
        }
      }
      
      console.warn('Could not find appropriate wishlist button to click');
    } catch (error) {
      console.error('Error in toggleWishlist:', error);
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
      console.log('Loading wishlist items...');
      
      // Try different selectors for collection items - in most recent Bandcamp design
      const selectors = [
        '.collection-item-container',
        '.collection-item-gallery',
        '.collection-item',
        '.collection-items .item',
        '.collection-items > li', // Sometimes items are in list items
        '[data-item-id]', // Items with data-item-id attributes
        '.collection-title-details' // Container with title and details
      ];
      
      let items: HTMLElement[] = null;
      
      // Try each selector until we find one that works
      for (const selector of selectors) {
        const elements = document.querySelectorAll<HTMLElement>(selector);
        if (elements && elements.length > 0) {
          console.log(`Found ${elements.length} items with selector: ${selector}`);
          items = Array.from(elements);
          break;
        }
      }
      
      if (!items || items.length === 0) {
        console.warn('No wishlist items found with any selector, trying more general selectors');
        
        // Try more general selectors as a fallback
        const fallbackSelectors = [
          '.collection-grid-item',
          '.música_grid li',
          '.music-grid li',
          '.collection-item-container',
          '.music_grid li'
        ];
        
        for (const selector of fallbackSelectors) {
          const elements = document.querySelectorAll<HTMLElement>(selector);
          if (elements && elements.length > 0) {
            console.log(`Found ${elements.length} items with fallback selector: ${selector}`);
            items = Array.from(elements);
            break;
          }
        }
        
        if (!items || items.length === 0) {
          console.warn('No wishlist items found with any selector');
          return [];
        }
      }
      
      // Find all items with play buttons or other interactive elements
      this._wishlistItems = items.filter(item => {
        // Check if the item has a play button or other meaningful data
        const playButton = item.querySelector('.play-button, .play-col .playbutton, [class*="play"], button[title*="Play"]');
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
                 console.log(`Manual play detected on wishlist item index: ${index}`);
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
      
      console.log(`Found ${this._wishlistItems.length} playable wishlist items`);
      return this._wishlistItems;
    } catch (error) {
      console.error('Error loading wishlist items:', error);
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
        const albumLinks = Array.from(item.querySelectorAll('a[href*="/album/"]'));
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
          const trackLinks = Array.from(item.querySelectorAll('a[href*="/track/"]'));
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
        const images = Array.from(item.querySelectorAll('img[src*="bcbits.com/img"]'));
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
        const scriptElements = Array.from(item.querySelectorAll('script[type="application/ld+json"]'));
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
            console.log(`Found potential track ID in data attribute ${attrName}: ${attrValue}`);
            break;
          }
        }
      }
      
      // Store the track ID as a data attribute on the item element
      if (trackId) {
        item.setAttribute('data-track-id', trackId);
        console.log(`Successfully extracted track ID for item ${index}: ${trackId}`);
      } else {
        // Generate a fallback ID
        const uniqueId = `generated-${index}-${Date.now()}`;
        item.setAttribute('data-generated-id', uniqueId);
        console.log(`Could not find track ID for item ${index}`);
        
        // Store any URLs we found as data attributes for fallback
        if (!item.hasAttribute('data-track-href')) {
          const anyLink = item.querySelector('a');
          if (anyLink) {
            item.setAttribute('data-track-href', anyLink.getAttribute('href'));
          }
        }
      }
    } catch (error) {
      console.error(`Error extracting track ID for item ${index}:`, error);
    }
  }

  /**
   * Play a specific track from the wishlist
   * @param index Index of the track to play
   */
  public static playWishlistTrack(index: number): void {
    if (!this.isWishlistPage || this._wishlistItems.length === 0) {
      console.warn('Cannot play wishlist track - not on wishlist page or no items loaded');
      return;
    }

    try {
      // Check if index is within bounds
      if (index < 0 || index >= this._wishlistItems.length) {
        console.warn(`Track index ${index} is out of bounds (0-${this._wishlistItems.length - 1})`);
        return;
      }

      const item = this._wishlistItems[index];
      
      // Store the current index
      this._currentWishlistIndex = index;
      
      console.log(`Attempting to play wishlist track ${index + 1} of ${this._wishlistItems.length}`);
      
      // Try to find and click the play button directly
      let playButton = this.findPlayButton(item);
      
      if (playButton) {
        console.log(`Found play button for wishlist track ${index + 1}, clicking it`);
        playButton.click();
        
        // Verify if playback started after a short delay
        setTimeout(() => {
          const audio = document.querySelector('audio');
          
          // If audio isn't playing within 1 second, move to next track
          if (!audio || audio.paused || !audio.src || audio.src.includes('track_id=&')) {
            console.log(`Track ${index + 1} failed to play, moving to next track`);
            this.playNextWishlistTrack();
          } else {
            console.log(`Track ${index + 1} is playing successfully`);
          }
        }, 1000);
        
        return;
      }
      
      // No play button found, try to click an item to select it
      console.log(`No play button found for track ${index + 1}, trying to click the item itself`);
      
      // Try to find any clickable element
      const clickableElements = item.querySelectorAll('a, button, [role="button"]');
      
      if (clickableElements.length > 0) {
        // Try to click the first element that isn't an explicit "buy" or "share" button
        let clicked = false;
        
        for (let i = 0; i < clickableElements.length; i++) {
          const element = clickableElements[i] as HTMLElement;
          const text = element.textContent?.toLowerCase() || '';
          
          if (!text.includes('buy') && !text.includes('share') && !text.includes('wishlist')) {
            console.log(`Clicking element to select track`);
            element.click();
            clicked = true;
            
            // Try to find and click play button in the now-focused track
            setTimeout(() => {
              const playButton = document.querySelector('.carousel-player-inner .playbutton, .play-button');
              if (playButton) {
                console.log('Found play button in focused track, clicking it');
                (playButton as HTMLElement).click();
                
                // Check if playback started
                setTimeout(() => {
                  const audio = document.querySelector('audio');
                  if (!audio || audio.paused) {
                    console.log(`Track ${index + 1} failed to play after selection, moving to next track`);
                    this.playNextWishlistTrack();
                  }
                }, 1000);
              } else {
                console.log('No play button found after selection, moving to next track');
                this.playNextWishlistTrack();
              }
            }, 500);
            
            break;
          }
        }
        
        if (!clicked) {
          console.log('No suitable clickable element found, moving to next track');
          this.playNextWishlistTrack();
        }
      } else {
        console.log('No clickable elements found, moving to next track');
        this.playNextWishlistTrack();
      }
    } catch (error) {
      console.error('Error playing wishlist track:', error);
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
      console.log('Already processing a track change request, ignoring additional request');
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

      console.log(`Playing next wishlist track (${nextIndex + 1} of ${this._wishlistItems.length})`);
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
  public static playPreviousWishlistTrack(): void {
    if (!this.isWishlistPage || this._wishlistItems.length === 0) {
      return;
    }

    // Check if we already have a pending track request
    if (this._pendingNextTrackRequest || this._skipInProgress) {
      console.log('Already processing a track change request, ignoring additional request');
      return;
    }

    // Set a flag to prevent multiple concurrent skip requests
    this._pendingNextTrackRequest = true;
    this._skipInProgress = true;

    // Use a delay to ensure any previous track operations have completed
    setTimeout(() => {
      let prevIndex = this._currentWishlistIndex - 1;
      if (prevIndex < 0) {
        prevIndex = this._wishlistItems.length - 1; // Loop back to the last track
      }

      // Check if the previous track is in our problem list
      const item = this._wishlistItems[prevIndex];
      const trackId = item?.getAttribute('data-track-id');
      
      if (trackId && this._problemTrackIds.has(trackId)) {
        console.log(`Previous track (${prevIndex + 1}) has known issues, skipping it`);
        
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
            console.log(`Found valid previous track at index ${prevIndex + 1}`);
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
          console.warn('Could not find any valid previous tracks, staying on current track');
          this._pendingNextTrackRequest = false;
          this._skipInProgress = false;
          return;
        }
      }

      console.log(`Playing previous wishlist track (${prevIndex + 1} of ${this._wishlistItems.length})`);
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
      console.log(`Starting wishlist playback with ${this._wishlistItems.length} items`);
      this.playWishlistTrack(0);
    } else {
      console.warn('No wishlist items found to play');
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
      console.log('Setting up continuous playback for wishlist');
      
      // Wait for the audio element to be created (it might not exist immediately)
      const setupAudioListeners = () => {
        // Find the audio element
        const audio = document.querySelector('audio');
        if (!audio) {
          console.log('No audio element found yet, will check again soon');
          setTimeout(setupAudioListeners, 1000);
          return;
        }
        
        console.log('Found audio element, setting up ended event listener');
        
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
        
        console.log('Continuous playback setup complete');
      };
      
      // Start setting up listeners
      setupAudioListeners();
      
    } catch (error) {
      console.error('Error setting up continuous playback:', error);
    }
  }
  
  /**
   * Handler for when a track ends - plays the next track
   */
  private static handleTrackEnded = () => {
    console.log('Track ended, playing next track');
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
    
    console.log('Audio playback error:', error);
    
    // Stop if we're already processing an error
    if (BandcampFacade._errorRecoveryInProgress) {
      console.log('Already recovering from an error, ignoring additional error events');
      return;
    }
    
    // Set flag to prevent multiple error handlers from running simultaneously
    BandcampFacade._errorRecoveryInProgress = true;
    
    try {
      console.log('Attempting to recover from audio error');
      
      // Extract track ID from the current URL if possible
      let trackId = null;
      if (audio.src && audio.src.includes('track_id=')) {
        const urlParams = new URLSearchParams(audio.src.split('?')[1]);
        trackId = urlParams.get('track_id');
      }
      
      // If we have a track ID, add it to the problem list
      if (trackId && trackId !== '') {
        console.log(`[Bandcamp+] Adding track ID ${trackId} to problem list due to playback error`);
        BandcampFacade._problemTrackIds.add(trackId);
      }
      
      // Handle specific error types
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            console.log('Network error detected, attempting to reload audio');
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
            console.log('Media format error detected, skipping to next track immediately');
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
            console.log('Unrecoverable audio error, skipping to next track');
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
        console.log('Unrecoverable audio error, skipping to next track');
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
      console.error('Error in audio error handler:', e);
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
      console.log(`Created fixed stream URL: ${newUrl}`);
      
      // Set the new URL and attempt playback
      audio.src = newUrl;
      audio.load();
      
      // Give more time for the audio to load and play
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.error('Error playing with fixed URL:', e);
          
          // Try a second approach - create a completely new URL
          const directStreamUrl = `https://bandcamp.com/stream_redirect?enc=mp3-128&track_id=${trackId}&ts=${timestamp}`;
          console.log(`Trying direct stream URL: ${directStreamUrl}`);
          
          audio.src = directStreamUrl;
          audio.load();
          audio.play().catch(innerError => {
            console.error('Error playing with direct URL:', innerError);
            
            // Wait longer before giving up on this track
            setTimeout(() => {
              if (audio && !(audio as HTMLAudioElement).paused) {
                console.log('Direct URL approach eventually succeeded');
                BandcampFacade._errorRecoveryInProgress = false;
                BandcampFacade._consecutiveErrors = 0;
              } else {
                console.warn('All URL fixes failed, will attempt to skip track');
                
                // Try clicking the play button again as last resort
                const playButton = BandcampFacade.findPlayButton(currentItem);
                if (playButton) {
                  console.log('Trying to recover by clicking play button');
                  playButton.click();
                  
                  // Check after a longer delay if this approach worked
                  setTimeout(() => {
                    if (audio && !(audio as HTMLAudioElement).paused) {
                      console.log('Play button click recovery was successful');
                      BandcampFacade._errorRecoveryInProgress = false;
                      BandcampFacade._consecutiveErrors = 0;
                    } else {
                      console.warn('Play button click failed to recover playback');
                      // Skip to the next track after a longer delay to avoid race conditions
                      setTimeout(() => {
                        BandcampFacade._errorRecoveryInProgress = false;
                        console.log('Skipping to next track after attempted recovery');
                        BandcampFacade.playNextWishlistTrack();
                      }, 2000);
                    }
                  }, 2000);
                } else {
                  // If all else fails, skip to the next track
                  console.log('Could not recover current track, skipping to next');
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
          console.log('Fixed URL recovery was successful');
          BandcampFacade._errorRecoveryInProgress = false;
          BandcampFacade._consecutiveErrors = 0;
        } else {
          // The check in the error callback will handle this case
          console.log('Waiting for recovery attempt result...');
        }
      }, 1500);
      
    } catch (urlError) {
      console.error('Error creating fixed URL:', urlError);
      
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
      const selectors = [
        '.play-button',
        '.play-col .playbutton',
        '[class*="play"]',
        'button[title*="Play"]',
        'div[role="button"][title*="Play"]',
        'svg[class*="play"]',
        'a[class*="play"]'
      ];
      
      // Try each selector
      for (const selector of selectors) {
        const button = item.querySelector(selector);
        if (button) {
          return button as HTMLElement;
        }
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
      console.error('Error finding play button:', error);
      return null;
    }
  }
  
  /**
   * Verify if the current wishlist track is playing correctly
   * @param index The index of the track that should be playing
   */
  private static verifyWishlistPlayback(index: number): void {
    // Verify that audio is actually playing
    const audio = document.querySelector('audio');
    
    if (!audio) {
      console.warn('No audio element found during playback verification');
      return;
    }
    
    // Check if the audio is playing and not paused
    if (!audio.paused) {
      console.log(`Track ${index + 1} is playing successfully`);
      // Reset consecutive errors since we have a successful playback
      this._consecutiveErrors = 0;
    } else {
      // Audio is paused - check if it has a valid source and is just loading
      if (audio.src && !audio.src.includes('blob:') && !audio.src.includes('track_id=&')) {
        console.log(`Track ${index + 1} has valid source, waiting for playback to start`);
        // Check again after a short delay in case it's still loading
        setTimeout(() => {
          if (!audio.paused) {
            console.log(`Track ${index + 1} started playing after delay`);
            this._consecutiveErrors = 0;
          } else {
            console.warn(`Track ${index + 1} failed to play automatically`);
            this._consecutiveErrors++;
            
            // If we've tried a few times and it's still not playing, move to the next track
            if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
              console.warn(`Track ${index + 1} failed ${this._consecutiveErrors} times, skipping to next track`);
              // Add a delay before skipping to avoid race conditions
              setTimeout(() => {
                this.playNextWishlistTrack();
              }, 1000);
            }
          }
        }, 2000);
      } else {
        // The source is invalid
        console.warn(`Track ${index + 1} has invalid source: ${audio.src}`);
        this._consecutiveErrors++;
        
        // Try to fix the URL if it's missing the track ID
        if (audio.src.includes('track_id=&') || !audio.src.includes('track_id=')) {
          const currentItem = this._wishlistItems[index];
          if (currentItem) {
            const trackId = currentItem.getAttribute('data-track-id');
            if (trackId) {
              console.log(`[Bandcamp+] Detected stream URL with missing track ID: ${audio.src}`);
              console.log(`[Bandcamp+] Found track ID from collection item: ${trackId}`);
              
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
                console.log(`[Bandcamp+] Fixed stream URL: ${fixedUrl}`);
                
                // Set the new URL and try to play
                audio.src = fixedUrl;
                audio.load();
                audio.play().catch(e => {
                  console.log(`[Bandcamp+] Error playing fixed audio: ${e.message}`);
                  // If it still fails, skip to next track
                  setTimeout(() => {
                    this.playNextWishlistTrack();
                  }, 1000);
                });
              } catch (error) {
                console.error('Error fixing stream URL:', error);
                // Move to the next track
                setTimeout(() => {
                  this.playNextWishlistTrack();
                }, 1000);
              }
            } else {
              console.warn(`No track ID available for item ${index}, trying next track`);
              setTimeout(() => {
                this.playNextWishlistTrack();
              }, 1000);
            }
          } else {
            console.warn(`No wishlist item found at index ${index}, trying next track`);
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
      
      console.log('[Bandcamp+] Detected stream URL with missing track ID:', audio.src);
      
      // Get the current item
      const currentItem = BandcampFacade._wishlistItems[BandcampFacade._currentWishlistIndex];
      if (currentItem) {
        // Try to get the track ID
        const trackId = currentItem.getAttribute('data-track-id');
        if (trackId) {
          // Check if it's a known problematic track ID (like 3302866485)
          if (BandcampFacade._problemTrackIds.has(trackId) || trackId === '3302866485') {
            console.log(`[Bandcamp+] Detected known problematic track ID: ${trackId}, skipping track`);
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
          
          console.log('[Bandcamp+] Found track ID from collection item:', trackId);
          
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
            console.log('[Bandcamp+] Fixed stream URL:', fixedUrl);
            
            // Set the new URL and try to play
            audio.src = fixedUrl;
            audio.load();
            audio.play().catch(e => {
              console.log('[Bandcamp+] Error playing fixed audio:', e);
              
              // Check if this is a 404 error or media format error
              if (e.name === 'NotSupportedError' || 
                 (typeof e === 'object' && e.message && e.message.includes('404'))) {
                console.log('[Bandcamp+] Track may be unavailable (404/NotSupported), adding to problem list');
                BandcampFacade._problemTrackIds.add(trackId);
                
                // Move to next track directly
                setTimeout(() => {
                  BandcampFacade.playNextWishlistTrack();
                }, 500);
              } else {
                // For other errors, try a completely different URL format as last resort
                try {
                  const directStreamUrl = `https://bandcamp.com/stream_redirect?enc=mp3-128&track_id=${trackId}&ts=${timestamp}`;
                  console.log('[Bandcamp+] Trying direct stream URL as last resort:', directStreamUrl);
                  
                  audio.src = directStreamUrl;
                  audio.load();
                  audio.play().catch(directError => {
                    console.log('[Bandcamp+] Direct stream URL also failed:', directError);
                    
                    // Give up and move to next track
                    setTimeout(() => {
                      BandcampFacade.playNextWishlistTrack();
                    }, 500);
                  });
                } catch (directUrlError) {
                  console.error('[Bandcamp+] Error creating direct stream URL:', directUrlError);
                  setTimeout(() => {
                    BandcampFacade.playNextWishlistTrack();
                  }, 500);
                }
              }
            });
          } catch (error) {
            console.error('Error fixing stream URL:', error);
            
            // Move to the next track if we encounter an error
            setTimeout(() => {
              BandcampFacade.playNextWishlistTrack();
            }, 500);
          }
        } else {
          console.warn('[Bandcamp+] No track ID available for current item, trying next track');
          setTimeout(() => {
            BandcampFacade.playNextWishlistTrack();
          }, 500);
        }
      } else {
        console.warn('[Bandcamp+] No current wishlist item found, trying next track');
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
    try {
      // Try to find the buy button on the page
      const buyButton = document.querySelector('button.buyItem, .buy-button, .buyItem, [data-tralbumdata] button');
      
      if (buyButton) {
        console.log('Found buy button, clicking it');
        (buyButton as HTMLElement).click();
      } else {
        // Try alternate selectors for buy links
        const buyLink = document.querySelector('a.buyLink, a.buy-link, a[href*="buy"], .buyItem a');
        
        if (buyLink) {
          console.log('Found buy link, clicking it');
          (buyLink as HTMLElement).click();
        } else {
          console.warn('No buy button found on the current page');
        }
      }
    } catch (error) {
      console.error('Error clicking buy button:', error);
    }
  }

  /**
   * Buy the current track
   */
  public static buyCurrentTrack(): void {
    // Special handling for wishlist pages
    if (this.isWishlistPage && this._currentWishlistIndex >= 0 && this._wishlistItems.length > 0) {
      const currentItem = this._wishlistItems[this._currentWishlistIndex];
      if (currentItem) {
        console.log('C key detected - buying current track from wishlist');
        
        // Try to find a direct buy link in the current wishlist item
        const buyLink = currentItem.querySelector('a.buy-link, a.buyLink, a[href*="/buy"], a[href*="?buy"]');
        if (buyLink) {
          console.log('Found buy link, clicking it');
          (buyLink as HTMLElement).click();
          return;
        }
        
        // If no direct buy link in the item, try to find the track/album URL
        const trackLink = currentItem.querySelector('a[href*="/track/"], a[href*="/album/"]');
        if (trackLink) {
          // Get the href and add auto_buy parameter
          let href = (trackLink as HTMLAnchorElement).href;
          if (href.includes('?')) {
            href += '&auto_buy=true';
          } else {
            href += '?auto_buy=true';
          }
          console.log('Navigating to track page with auto_buy parameter:', href);
          window.location.href = href;
          return;
        }
        
        // If we can't find a track/album link, try to extract it from data attributes
        const trackUrl = currentItem.getAttribute('data-track-url') || 
                         currentItem.getAttribute('data-album-url') || 
                         currentItem.getAttribute('data-track-href');
        if (trackUrl) {
          // Get the URL and add auto_buy parameter
          let href = trackUrl;
          if (href.includes('?')) {
            href += '&auto_buy=true';
          } else {
            href += '?auto_buy=true';
          }
          console.log('Navigating to track URL from data attribute with auto_buy parameter:', href);
          window.location.href = href;
          return;
        }
        
        // Last attempt - look for any link that might lead to the track page
        const anyLink = currentItem.querySelector('a:not([href*="javascript"])');
        if (anyLink) {
          const href = (anyLink as HTMLAnchorElement).href;
          if (href && (href.includes('bandcamp.com') || href.startsWith('/'))) {
            // Add auto_buy parameter
            const autoBuyHref = href.includes('?') ? href + '&auto_buy=true' : href + '?auto_buy=true';
            console.log('Navigating to potentially related page with auto_buy parameter:', autoBuyHref);
            window.location.href = autoBuyHref;
            return;
          }
        }
        
        console.warn('Could not find any suitable link to the track page in the current wishlist item');
      } else {
        console.warn('Current wishlist item not found');
      }
    } else {
      // Default behavior for non-wishlist pages
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
        console.log('Play/pause toggle already in progress, ignoring request');
        return;
      }

      // Set the flag to indicate a toggle is in progress
      this._playPauseInProgress = true;

      // Special handling for wishlist pages
      if (this.isWishlistPage) {
        // Check if we need to start playback for the first time (no track selected yet)
        if (this._currentWishlistIndex < 0 && this._wishlistItems.length === 0) {
          console.log('Loading wishlist items for first-time playback');
          this.loadWishlistItems();
        }
        
        if (this._currentWishlistIndex < 0 && this._wishlistItems.length > 0) {
          console.log('No track currently selected on wishlist page, starting from first track');
          // Clear the flag before starting a new track to avoid lockout
          this._playPauseInProgress = false;
          this.startWishlistPlayback();
          return;
        }
        
        const wishlistAudio = document.querySelector('.carousel-player-inner audio') || 
                              document.querySelector('audio');
        
        if (wishlistAudio) {
          // Toggle play/pause state
          if ((wishlistAudio as HTMLAudioElement).paused) {
            console.log('Playing audio on wishlist page');
            (wishlistAudio as HTMLAudioElement).play()
              .then(() => {
                // Clear the flag after successful play
                setTimeout(() => {
                  this._playPauseInProgress = false;
                }, 300);
              })
              .catch(e => {
                console.error('Error playing audio:', e);
                // Clear the flag even if there's an error
                this._playPauseInProgress = false;
              });
          } else {
            console.log('Pausing audio on wishlist page');
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
        console.log('Clicking play button to toggle play/pause');
        playButton.click();
        // Clear the flag after a short delay for button click
        setTimeout(() => {
          this._playPauseInProgress = false;
        }, 300);
      } else {
        // Try direct audio control as fallback
        const audio = this.audio || document.querySelector('audio');
        if (audio) {
          if (audio.paused) {
            console.log('Playing audio directly');
            audio.play()
              .then(() => {
                // Clear the flag after successful play
                setTimeout(() => {
                  this._playPauseInProgress = false;
                }, 300);
              })
              .catch(e => {
                console.error('Error playing audio:', e);
                // Clear the flag even if there's an error
                this._playPauseInProgress = false;
              });
          } else {
            console.log('Pausing audio directly');
            audio.pause();
            // Clear the flag after a short delay for pausing
            setTimeout(() => {
              this._playPauseInProgress = false;
            }, 300);
          }
        } else {
          console.warn('No play button or audio element found for toggle play/pause');
          // Clear the flag immediately if we couldn't find anything to toggle
          this._playPauseInProgress = false;
        }
      }
    } catch (error) {
      console.error('Error in togglePlayPause:', error);
      // Make sure to clear the flag even if there's an error
      this._playPauseInProgress = false;
    }
  }

  /**
   * Toggle wishlist status for the currently playing track in the wishlist
   */
  public static toggleCurrentTrackWishlist(): void {
    if (!this.isWishlistPage || this._currentWishlistIndex < 0 || !this._wishlistItems.length) {
      console.warn('Cannot toggle current track wishlist - not on wishlist page or no track selected');
      return;
    }

    try {
      // Get the current wishlist item
      const currentItem = this._wishlistItems[this._currentWishlistIndex];
      if (!currentItem) {
        console.warn('Current wishlist item not found');
        return;
      }
      
      // Try to find the track ID for this item to use in the API call
      const trackId = currentItem.getAttribute('data-track-id') || 
                      currentItem.getAttribute('data-item-id') || 
                      currentItem.getAttribute('data-tralbum-id');
      
      if (trackId) {
        console.log(`Found track ID ${trackId} for wishlist toggle`);
        
        // Get the item_type (track or album) from URL if possible
        let itemType = 'track'; // Default to track
        const itemLinks = currentItem.querySelectorAll('a[href*="/album/"], a[href*="/track/"]');
        if (itemLinks.length > 0) {
          const href = itemLinks[0].getAttribute('href');
          if (href && href.includes('/album/')) {
            itemType = 'album';
          }
        }
        
        // First try to use direct XHR to toggle wishlist status
        // We need fan_id which might be in the page data
        const pageData = document.getElementById('pagedata');
        if (pageData) {
          const dataBlob = pageData.getAttribute('data-blob');
          if (dataBlob) {
            try {
              const data = JSON.parse(dataBlob);
              const fanId = data.fan_id || (data.fan_tralbum_data && data.fan_tralbum_data.fan_id);
              
              if (fanId) {
                console.log(`Found fan ID: ${fanId}, attempting to toggle wishlist via API`);
                
                // Get the appropriate endpoint
                // Since we're on the wishlist page, we want to remove (uncollect) the item
                const endpoint = 'uncollect_item_cb';
                
                // Create the request payload
                const payload = new URLSearchParams();
                payload.append('fan_id', fanId.toString());
                payload.append('item_id', trackId);
                payload.append('item_type', itemType);
                payload.append('platform', 'desktop');
                
                // Get a CSRF token if available
                const csrfTokenElement = document.querySelector('meta[name="csrf-token"]');
                if (csrfTokenElement) {
                  const csrfToken = csrfTokenElement.getAttribute('content');
                  if (csrfToken) {
                    payload.append('csrf_token', csrfToken);
                  }
                }
                
                // Make the request
                fetch(`https://${window.location.host}/${endpoint}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: payload.toString(),
                  credentials: 'same-origin'
                })
                .then(response => response.json())
                .then(data => {
                  console.log('Wishlist toggle response:', data);
                  if (data.ok) {
                    console.log('Successfully toggled wishlist status via API!');
                    
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
                  }
                })
                .catch(error => {
                  console.error('Error toggling wishlist via API:', error);
                  // Fall back to clicking UI elements
                  this.fallbackToWishlistButtonClick(currentItem);
                });
                
                return;
              }
            } catch (parseError) {
              console.error('Error parsing page data:', parseError);
            }
          }
        }
      }
      
      // If we couldn't use the API approach, fall back to clicking UI elements
      this.fallbackToWishlistButtonClick(currentItem);
      
    } catch (error) {
      console.error('Error toggling current track wishlist:', error);
    }
  }
  
  /**
   * Fallback method to find and click wishlist button in the UI
   * @param currentItem The current wishlist item element
   */
  private static fallbackToWishlistButtonClick(currentItem: HTMLElement): void {
    console.log('Falling back to wishlist button click method');
    
    try {
      // First, try to find the specifically styledin-wishlist element in the player
      const inWishlistButton = document.querySelector('.wishlisted-msg a, .wishlisted-msg.collection-btn a');
      if (inWishlistButton) {
        console.log('Found in-wishlist button in player, clicking it');
        (inWishlistButton as HTMLElement).click();
        
        // Wait for the XHR to complete and update the wishlist icon
        setTimeout(() => {
          // Update any heart/wishlist icons, but don't remove the item from the UI
          this.updateWishlistIcons(currentItem, false);
        }, 500);
        
        return;
      }
      
      // Look for wishlist toggle elements within the current item
      const wishlistButton = currentItem.querySelector(
        '.wishlisted-msg a, .wishlisted-msg.collection-btn a, ' +
        '.item-collection-controls.wishlisted a, ' + 
        '[title*="Remove this album from your wishlist"], [title*="Remove this track from your wishlist"]'
      );
      
      if (wishlistButton) {
        console.log('Found wishlist removal button in current track, clicking it');
        (wishlistButton as HTMLElement).click();
        
        // Update UI after a short delay
        setTimeout(() => {
          // Just update the wishlist icons, don't remove the item
          this.updateWishlistIcons(currentItem, false);
        }, 500);
        
        return;
      }
      
      // Try to find a button with "in wishlist" text specifically
      const wishlistedElements = Array.from(document.querySelectorAll('a, span, .wishlisted-msg, [class*="wishlist"]'))
        .filter(element => {
          const text = element.textContent?.toLowerCase() || '';
          const title = element.getAttribute('title')?.toLowerCase() || '';
          return text.includes('in wishlist') || 
                 text.includes('wishlisted') || 
                 title.includes('remove') && title.includes('wishlist');
        });
      
      if (wishlistedElements.length > 0) {
        console.log('Found element with "in wishlist" text, clicking it');
        
        // Find the closest clickable parent or the element itself if it's clickable
        let elementToClick = wishlistedElements[0] as HTMLElement;
        if (elementToClick.tagName !== 'A' && elementToClick.tagName !== 'BUTTON') {
          const clickableParent = elementToClick.closest('a, button, [role="button"]');
          if (clickableParent) {
            elementToClick = clickableParent as HTMLElement;
          }
        }
        
        elementToClick.click();
        
        // Update UI after a short delay
        setTimeout(() => {
          // Update wishlist icon state
          this.updateWishlistIcons(currentItem, false);
        }, 500);
        
        return;
      }
      
      // If none of those specific approaches work, try finding elements in the control panel
      const itemControls = document.querySelector('.item-collection-controls.wishlisted');
      if (itemControls) {
        console.log('Found item collection controls with wishlisted class');
        const removalLink = itemControls.querySelector('.wishlisted-msg a') as HTMLElement;
        if (removalLink) {
          console.log('Found removal link in collection controls, clicking it');
          removalLink.click();
          
          // Update UI after a short delay
          setTimeout(() => this.updateWishlistIcons(currentItem, false), 500);
          return;
        }
      }
      
      // Try to find a link to the track/album page as last resort
      const trackLink = currentItem.querySelector('a[href*="/track/"], a[href*="/album/"]');
      if (trackLink) {
        // Get the href and navigate to it
        const href = (trackLink as HTMLAnchorElement).href;
        console.log('No direct wishlist button found, navigating to track page:', href);
        
        // Save current position before navigating away
        const audio = document.querySelector('audio');
        const currentTime = audio ? audio.currentTime : 0;
        
        // Store the current track info in sessionStorage so we can return to it
        sessionStorage.setItem('bandcampPlus_lastTrackIndex', this._currentWishlistIndex.toString());
        sessionStorage.setItem('bandcampPlus_lastTrackTime', currentTime.toString());
        
        // Navigate to the track page where wishlist toggle will be available
        window.location.href = href;
        return;
      }
      
      console.warn('Could not find any wishlist toggle or track link for the current track');
    } catch (error) {
      console.error('Error in fallbackToWishlistButtonClick:', error);
    }
  }
  
  /**
   * Helper method to update wishlist icons without removing the item
   * @param item The wishlist item to update
   * @param isInWishlist Whether the item is in the wishlist or not
   */
  private static updateWishlistIcons(item: HTMLElement, isInWishlist: boolean): void {
    console.log(`Updating wishlist icons (isInWishlist: ${isInWishlist})`);
    
    try {
      // Find all wishlist-related UI elements
      const heartIcons = item.querySelectorAll('.wishlist-icon, .fav-icon, [class*="heart"], .bc-ui2.icon.wishlist');
      const itemControls = item.querySelector('.item-collection-controls') || 
                          document.querySelector('.item-collection-controls');
      
      // Update heart icons if any
      if (heartIcons.length > 0) {
        heartIcons.forEach(icon => {
          // Toggle filled/unfilled classes based on wishlist state
          if (isInWishlist) {
            icon.classList.remove('unfilled', 'empty');
            icon.classList.add('filled');
          } else {
            icon.classList.remove('filled');
            icon.classList.add('unfilled', 'empty');
          }
        });
        console.log(`Updated ${heartIcons.length} heart icons`);
      }
      
      // Update item controls classes if found
      if (itemControls) {
        if (isInWishlist) {
          itemControls.classList.add('wishlisted');
          itemControls.classList.remove('not-wishlisted');
        } else {
          itemControls.classList.remove('wishlisted');
          itemControls.classList.add('not-wishlisted');
        }
        
        // Toggle visibility of wishlist/wishlisted message elements
        const wishlistMsg = itemControls.querySelector('.wishlist-msg');
        const wishlistedMsg = itemControls.querySelector('.wishlisted-msg');
        
        if (wishlistMsg && wishlistedMsg) {
          if (isInWishlist) {
            wishlistMsg.classList.add('hidden');
            wishlistedMsg.classList.remove('hidden');
          } else {
            wishlistMsg.classList.remove('hidden');
            wishlistedMsg.classList.add('hidden');
          }
        }
        
        console.log('Updated item collection controls to reflect wishlist state');
      }
      
      // Set a custom attribute to track state
      item.setAttribute('data-bcwf-wishlisted', isInWishlist ? 'true' : 'false');
      
      // Add a subtle visual indication that the toggle worked
      const originalBackground = item.style.backgroundColor;
      item.style.transition = 'background-color 0.3s ease-out';
      item.style.backgroundColor = isInWishlist ? 'rgba(0, 128, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)';
      
      // Revert back after a moment
      setTimeout(() => {
        item.style.backgroundColor = originalBackground;
      }, 300);
      
    } catch (error) {
      console.error('Error updating wishlist icons:', error);
    }
  }
  
  /**
   * Helper method to handle wishlist item removal UI updates
   * @param item The wishlist item to update UI for
   */
  private static handleWishlistItemRemoval(item: HTMLElement): void {
    console.log('Updating wishlist UI state (not removing item)');
    
    // Just update the wishlist icons instead of removing the item
    this.updateWishlistIcons(item, false);
  }

  /**
   * Load more discovery items from the Bandcamp discovery page
   * @returns Promise that resolves to true if more items were loaded
   */
  public static async loadMoreDiscoveryItems(): Promise<boolean> {
    if (!window.location.href.includes('/discover')) {
      console.warn('Not on discovery page, cannot load more items');
      return false;
    }

    try {
      console.log('Loading more discovery items');
      
      // Look for the "load more" button on the discovery page
      const loadMoreButton = document.querySelector('.show-more button, button.show-more, [data-bind*="loadMore"]');
      
      if (loadMoreButton) {
        console.log('Found load more button, clicking it');
        (loadMoreButton as HTMLElement).click();
        
        // Wait for items to load
        return new Promise<boolean>((resolve) => {
          // Check if new items have been added after a short delay
          setTimeout(() => {
            const currentItems = document.querySelectorAll('.discover-item, .discovery-item, .item');
            console.log(`Found ${currentItems.length} discovery items after loading more`);
            resolve(true);
          }, 2000);
        });
      } else {
        console.warn('No load more button found on discovery page');
        return false;
      }
    } catch (error) {
      console.error('Error loading more discovery items:', error);
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
      const selectors = [
        '.discover-item', 
        '.discovery-item', 
        '.discover-results .item',
        '.discover-results li',
        '.item[data-item-id]'
      ];
      
      let discoveryItems: HTMLElement[] = [];
      
      for (const selector of selectors) {
        const items = document.querySelectorAll<HTMLElement>(selector);
        if (items && items.length > 0) {
          console.log(`Found ${items.length} discovery items with selector: ${selector}`);
          discoveryItems = Array.from(items);
          break;
        }
      }
      
      if (discoveryItems.length === 0) {
        console.warn('No discovery items found');
      }
      
      return discoveryItems;
    } catch (error) {
      console.error('Error getting discovery items:', error);
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
      const selectors = [
        '.featured-item', 
        '.discover-featured .item',
        '.featured-items .item',
        '.featured'
      ];
      
      for (const selector of selectors) {
        const items = document.querySelectorAll<HTMLElement>(selector);
        if (items && items.length > 0) {
          console.log(`Found ${items.length} featured discovery items with selector: ${selector}`);
          return Array.from(items);
        }
      }
      
      console.warn('No featured discovery items found');
      return [];
    } catch (error) {
      console.error('Error getting featured discovery items:', error);
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
      console.warn('Not on discovery page, cannot click discovery item');
      return false;
    }
    
    try {
      const discoveryItems = document.querySelectorAll('.discover-item, .discovery-item, [data-item-id]');
      
      if (!discoveryItems || discoveryItems.length === 0) {
        console.warn('No discovery items found on page');
        return false;
      }
      
           if (index < 0 || index >= discoveryItems.length) {
        console.warn(`Invalid discovery item index: ${index}. Available range: 0-${discoveryItems.length - 1}`);
        return false;
      }
      
      const item = discoveryItems[index] as HTMLElement;
      item.click();
      
      console.log(`Clicked on discovery item at index ${index}`);
      return true;
    } catch (error) {
      console.error('Error clicking discovery item:', error);
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
      console.warn('Not on discovery page, cannot click featured discovery item');
      return false;
    }
    
    try {
      const featuredItems = document.querySelectorAll('.featured-item, .featured-discovery-item, .discover-featured-item');
      
      if (!featuredItems || featuredItems.length === 0) {
        console.warn('No featured discovery items found on page');
        return false;
      }
      
      if (index < 0 || index >= featuredItems.length) {
        console.warn(`Invalid featured item index: ${index}. Available range: 0-${featuredItems.length - 1}`);
        return false;
      }
      
      const item = featuredItems[index] as HTMLElement;
      item.click();
      
      console.log(`Clicked on featured discovery item at index ${index}`);
      return true;
    } catch (error) {
      console.error('Error clicking featured discovery item:', error);
      return false;
    }
  }
  
  /**
   * Get the available discovery filters
   * @returns An object containing the available filters
   */
  public static getDiscoveryFilters(): Record<string, any> {
    if (!window.location.href.includes('/discover')) {
      console.warn('Not on discovery page, cannot get discovery filters');
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
      console.error('Error getting discovery filters:', error);
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
      console.warn('Not on discovery page, cannot apply discovery filter');
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
        console.warn(`Unknown filter type: ${filterType}`);
        return false;
      }
      
      // Find the filter element
      const filterElement = document.querySelector(selector);
      if (!filterElement) {
        console.warn(`Filter element not found for filter type: ${filterType}`);
        return false;
      }
      
      // Check if it's a select element
      if (filterElement.tagName === 'SELECT') {
        const selectElement = filterElement as HTMLSelectElement;
        selectElement.value = value;
        
        // Trigger change event
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
        
        console.log(`Applied ${filterType} filter with value: ${value}`);
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
          console.log(`Applied ${filterType} filter with value: ${value}`);
          return true;
        }
      }
      
      console.warn(`Could not find option with value ${value} for filter type ${filterType}`);
      return false;
    } catch (error) {
      console.error('Error applying discovery filter:', error);
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
      console.warn('Not on discovery page, cannot save discovery preferences');
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
          console.error('Error parsing existing preferences:', error);
          preferences = {};
        }
      }
      
      // Save the new preference
      preferences[name] = currentUrl;
      
      // Save back to localStorage
      localStorage.setItem('bandcampPlusDiscoveryPreferences', JSON.stringify(preferences));
      
      console.log(`Saved discovery preference '${name}' with URL: ${currentUrl}`);
      return true;
    } catch (error) {
      console.error('Error saving discovery preference:', error);
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
        console.warn('No saved discovery preferences found');
        return false;
      }
      
      let preferences: Record<string, string>;
      
      try {
        preferences = JSON.parse(existingPreferencesString);
      } catch (error) {
        console.error('Error parsing discovery preferences:', error);
        return false;
      }
      
      const savedUrl = preferences[name];
      
      if (!savedUrl) {
        console.warn(`No discovery preference found with name: ${name}`);
        return false;
      }
      
      // Navigate to the saved URL
      console.log(`Loading discovery preference '${name}' with URL: ${savedUrl}`);
      window.location.href = savedUrl;
      return true;
    } catch (error) {
      console.error('Error loading discovery preference:', error);
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
        console.error('Error parsing discovery preferences:', error);
        return {};
      }
    } catch (error) {
      console.error('Error getting stored discovery preferences:', error);
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
        console.warn('No saved discovery preferences found');
        return false;
      }
      
      let preferences: Record<string, string>;
      
      try {
        preferences = JSON.parse(existingPreferencesString);
      } catch (error) {
        console.error('Error parsing discovery preferences:', error);
        return false;
      }
      
      if (!preferences[name]) {
        console.warn(`No discovery preference found with name: ${name}`);
        return false;
      }
      
      // Delete the preference
      delete preferences[name];
      
      // Save back to localStorage
      localStorage.setItem('bandcampPlusDiscoveryPreferences', JSON.stringify(preferences));
      
      console.log(`Deleted discovery preference: ${name}`);
      return true;
    } catch (error) {
      console.error('Error deleting discovery preference:', error);
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
      console.error('Error navigating to discovery page:', error);
      return false;
    }
  }

  /**
   * Load all wishlist items by clicking the "view all items" button
   * @returns Promise that resolves to true if all items were loaded successfully
   */
  public static async loadAllWishlistItems(): Promise<boolean> {
    if (!this.isWishlistPage) {
      console.warn('Not on wishlist page, cannot load all items');
      return false;
    }

    try {
      console.log('Attempting to load all wishlist items...');
      
      // Look for "show-more" buttons
      const showMoreButtons = Array.from(document.getElementsByClassName('show-more')) as HTMLElement[];
      console.log(`Found ${showMoreButtons.length} buttons with class="show-more"`);
      
      // GOAL: Find the button specific to the wishlist tab, not the collection tab
      
      // First check if we're already on the wishlist tab
      const isWishlistTabActive = document.querySelector('li[data-tab="wishlist"].active, .wishlist.active, a[href*="wishlist"].active') !== null;
      console.log(`Wishlist tab active: ${isWishlistTabActive}`);
      
      // Try to get the number entries in each section from the tab counts
      const tabCounts: Record<string, number> = {};
      const tabs = document.querySelectorAll('li[data-tab], .tabs > li, .tab-sides > li');
      
      tabs.forEach(tab => {
        const countElement = tab.querySelector('.count');
        if (countElement) {
          const tabName = tab.getAttribute('data-tab') || 
                         tab.className.toLowerCase().replace('active', '').trim() ||
                         tab.textContent?.toLowerCase().trim().replace(/[^a-z]/g, '');
          
          const count = parseInt(countElement.textContent || '0', 10);
          if (!isNaN(count)) {
            tabCounts[tabName] = count;
            console.log(`Tab "${tabName}" has count: ${count}`);
          }
        }
      });
      
      // Find buttons with "view all X items" text
      const itemButtons = showMoreButtons.filter(button => {
        const text = button.textContent?.trim().toLowerCase() || '';
        return /^view all \d+ items?$/.test(text);
      });
      
      console.log(`Found ${itemButtons.length} buttons with "view all X items" text`);
      
      // Extract counts from button text for sorting
      const buttonDetails = itemButtons.map(button => {
        const text = button.textContent?.trim().toLowerCase() || '';
        const match = text.match(/view all (\d+) items?/);
        const count = match ? parseInt(match[1], 10) : 0;
        
        return { button, count, text };
      });
      
      console.log('Available item buttons:');
      buttonDetails.forEach(details => {
        console.log(`- "${details.text}" (count: ${details.count})`);
      });
      
      // Look for the wishlist count in the tab counts
      let wishlistCount = tabCounts['wishlist'] || 0;
      console.log(`Wishlist count from tabs: ${wishlistCount}`);
      
      // Match button with the count that matches the wishlist tab count
      let wishlistButton = buttonDetails.find(details => details.count === wishlistCount)?.button;
      
      // If we couldn't find a matching button by count, try other approaches
      if (!wishlistButton && buttonDetails.length > 1) {
        console.log('Could not find button with count matching wishlist tab, using position approach');
        
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
          console.log('Buttons sorted by count:');
          buttonsByCount.forEach(({ button, count }) => {
            console.log(`  "${button.textContent?.trim()}" - count: ${count}`);
          });
          
          // Take the button with the smallest count - which should be the wishlist count
          if (buttonsByCount.length > 0) {
            wishlistButton = buttonsByCount[0].button;
            console.log(`Selected wishlist button by count: "${wishlistButton.textContent?.trim()}"`);
          }
        } else if (buttonDetails.length === 1) {
          // If there's only one button, use it
          wishlistButton = buttonDetails[0].button;
          console.log(`Only one 'items' button found, using it: "${wishlistButton.textContent?.trim()}"`);
        }
      } else if (wishlistButton) {
        console.log(`Found wishlist button by matching tab count: "${wishlistButton.textContent?.trim()}"`);
      }
      
      if (!wishlistButton) {
        console.warn('Could not determine which button is for the wishlist');
        return false;
      }
      
      console.log(`Clicking wishlist button: "${wishlistButton.textContent?.trim()}"`);
      
      // Save the current scroll position
      const originalScrollPosition = window.scrollY;
      
      // Click the wishlist "view all items" button
      try {
        wishlistButton.click();
        console.log('Clicked wishlist "view all items" button');
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Restore scroll position
        window.scrollTo(0, originalScrollPosition);
        
        // Reload wishlist items
        const items = this.loadWishlistItems();
        console.log(`Loaded ${items.length} wishlist items after clicking "view all items" button`);
        
        return items.length > 0;
      } catch (clickError) {
        console.warn(`Error clicking wishlist "view all items" button:`, clickError);
        return false;
      }
    } catch (error) {
      console.error('Error loading all wishlist items:', error);
      return false;
    }
  }
}
