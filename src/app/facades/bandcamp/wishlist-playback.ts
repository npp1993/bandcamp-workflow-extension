/**
 * Wishlist / collection continuous-playback engine.
 *
 * Extracted from BandcampFacade: loading wishlist/collection items, starting and
 * advancing playback, error recovery for failed tracks, locating play buttons, and
 * verifying playback. Playback state and a few small helpers (pageType, problem-track
 * tracking, scroll/visibility helpers) remain on BandcampFacade; this module reaches
 * them via the facade. BandcampFacade exposes thin delegators for the public methods.
 */
import {BandcampFacade} from '../bandcamp.facade';
import {Logger} from '../../utils/logger';
import {AudioUtils} from '../../utils/audio-utils';
import {DOMSelectors} from '../../utils/dom-selectors';
import {ErrorHandler} from '../../utils/error-handler';
import {ShuffleService} from '../../services/shuffle.service';
import {WISHLIST_LOADING_CLASS} from '../../constants';

export class WishlistPlayback {
  /**
   * Load all wishlist items on the current page
   */
  public static loadWishlistItems(): HTMLElement[] {
    if (!BandcampFacade.isCollectionBasedPage) {
      return [];
    }

    try {
      const pageType = BandcampFacade.isWishlistPage ? 'wishlist' : 'collection';
      Logger.debug(`Loading ${pageType} items...`);
      
      // First, try to find items only within the currently active wishlist container
      // This helps avoid double-counting items from other tabs (like collection)
      let items: HTMLElement[] = [];
      
      // Look for containers (both wishlist and collection specific)
      // Define container priorities based on current page type
      let containers: string[];
      
      if (BandcampFacade.isCollectionPage) {
        // For collection pages, prioritize collection containers
        containers = [
          '#collection-grid',            // Primary collection container
          '[data-grid-id="collection-grid"]', // Alternative collection attribute-based selector
          '#wishlist-grid',              // Fallback: Primary wishlist container  
          '[data-grid-id="wishlist-grid"]', // Alternative wishlist attribute-based selector
          '.collection-content',         // Generic collection content container
          '.wishlist-content',           // Generic wishlist content container
          '.grid-content',               // Generic grid content container
        ];
      } else if (BandcampFacade.isWishlistPage) {
        // For wishlist pages, prioritize wishlist containers
        containers = [
          '#wishlist-grid',              // Primary wishlist container
          '[data-grid-id="wishlist-grid"]', // Alternative wishlist attribute-based selector
          '#collection-grid',            // Fallback: Primary collection container
          '[data-grid-id="collection-grid"]', // Alternative collection attribute-based selector
          '.wishlist-content',           // Generic wishlist content container
          '.collection-content',         // Generic collection content container
          '.grid-content',               // Generic grid content container
        ];
      } else {
        // For other collection-based pages, try both but prefer collection first
        containers = [
          '#collection-grid',            // Primary collection container
          '[data-grid-id="collection-grid"]', // Alternative collection attribute-based selector
          '#wishlist-grid',              // Primary wishlist container
          '[data-grid-id="wishlist-grid"]', // Alternative wishlist attribute-based selector
          '.collection-content',         // Generic collection content container
          '.wishlist-content',           // Generic wishlist content container
          '.grid-content',               // Generic grid content container
        ];
      }
      
      for (const containerSelector of containers) {
        const container = document.querySelector(containerSelector);
        if (container) {
          Logger.debug(`Found container: ${containerSelector}`);
          
          // Log detailed selector effectiveness for this container (only in debug mode)
          if (Logger.isDebugEnabled()) {
            const selectorResults: string[] = [];
            DOMSelectors.WISHLIST_ITEMS.forEach(selector => {
              const selectorItems = container.querySelectorAll(selector);
              if (selectorItems.length > 0) {
                selectorResults.push(`${selector}: ${selectorItems.length} items`);
              }
            });
            
            if (selectorResults.length > 0) {
              Logger.debug(`Selector effectiveness in ${containerSelector}:`, selectorResults.join(', '));
            }
          }
          
          items = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.WISHLIST_ITEMS, container as HTMLElement);
          if (items.length > 0) {
            Logger.debug(`Found ${items.length} items in specific container`);
            
            // Log the actual structure of first few items for analysis
            if (items.length > 0 && Logger.isDebugEnabled()) {
              const firstItem = items[0];
              const itemClasses = firstItem.className;
              const itemTag = firstItem.tagName.toLowerCase();
              const hasPlayButton = DOMSelectors.findOneWithSelectors<HTMLElement>(DOMSelectors.PLAY_BUTTONS, firstItem) !== null;
              const hasDataId = firstItem.hasAttribute('data-item-id') || firstItem.hasAttribute('data-tralbum-id');
              Logger.debug(`Sample item structure: ${itemTag}.${itemClasses.replace(/\s+/g, '.')}, hasPlayButton: ${hasPlayButton}, hasDataId: ${hasDataId}`);
            }
            
            break;
          }
        }
      }
      
      // If no items found in specific containers, fall back to general search
      // but ensure we're only getting items that are currently visible
      if (items.length === 0) {
        Logger.debug('No items found in specific containers, falling back to general search');
        
        // Log which selectors work globally
        if (Logger.isDebugEnabled()) {
          const globalSelectorResults: string[] = [];
          DOMSelectors.WISHLIST_ITEMS.forEach(selector => {
            const globalItems = document.querySelectorAll(selector);
            if (globalItems.length > 0) {
              globalSelectorResults.push(`${selector}: ${globalItems.length} items`);
            }
          });
          
          if (globalSelectorResults.length > 0) {
            Logger.debug('Global selector effectiveness:', globalSelectorResults.join(', '));
          }
        }
        
        const allItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.WISHLIST_ITEMS);
        
        // Filter to only include items that are currently visible and likely part of wishlist
        items = allItems.filter(item => {
          // Check if the item is visible
          const rect = item.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          // Check if the item is not hidden by display:none or visibility:hidden
          const style = window.getComputedStyle(item);
          const isDisplayed = style.display !== 'none' && style.visibility !== 'hidden';
          
          return isVisible && isDisplayed;
        });
        
        Logger.debug(`Found ${items.length} visible items`);
        
        // Log filtering results in debug mode
        if (Logger.isDebugEnabled() && allItems.length !== items.length) {
          Logger.debug(`Filtered ${allItems.length} → ${items.length} items (removed ${allItems.length - items.length} hidden/invisible items)`);
        }
      }
      
      if (!items || items.length === 0) {
        Logger.warn('No items found with any selector, trying more general selectors');
        
        // Log fallback selector effectiveness
        if (Logger.isDebugEnabled()) {
          const fallbackSelectorResults: string[] = [];
          DOMSelectors.WISHLIST_ITEMS_FALLBACK.forEach(selector => {
            const fallbackItems = document.querySelectorAll(selector);
            if (fallbackItems.length > 0) {
              fallbackSelectorResults.push(`${selector}: ${fallbackItems.length} items`);
            }
          });
          
          if (fallbackSelectorResults.length > 0) {
            Logger.debug('Fallback selector effectiveness:', fallbackSelectorResults.join(', '));
          }
        }
        
        // Try more general selectors as a fallback
        items = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.WISHLIST_ITEMS_FALLBACK);
        
        if (items.length > 0) {
          Logger.debug(`Found ${items.length} items with fallback selectors`);
        }
        
        if (!items || items.length === 0) {
          Logger.warn('No items found with any selector');
          
          // Log DOM structure for debugging when no items are found
          if (Logger.isDebugEnabled()) {
            const potentialContainers = document.querySelectorAll('[class*="collection"], [class*="wishlist"], [class*="grid"], [class*="item"]');
            if (potentialContainers.length > 0) {
              Logger.debug(`Found ${potentialContainers.length} potential container elements for analysis`);
              
              // Log first few container classes for debugging
              for (let i = 0; i < Math.min(5, potentialContainers.length); i++) {
                const container = potentialContainers[i] as HTMLElement;
                Logger.debug(`Container ${i + 1}: ${container.tagName.toLowerCase()}.${container.className.replace(/\s+/g, '.')}`);
              }
            }
          }
          
          return [];
        }
      }
      
      // Find all items with play buttons or other interactive elements
      BandcampFacade._wishlistItems = items.filter((item) => {
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

      // Distinguish albums from tracks visually
      BandcampFacade._wishlistItems.forEach(item => {
        let isAlbum = false;
        
        // Check data attributes first (most reliable if present)
        const itemType = item.getAttribute('data-itemtype') || item.getAttribute('data-item-type');
        
        if (itemType) {
          isAlbum = itemType === 'album' || itemType === 'package';
        } else {
          // Fallback: Check the main artwork link ONLY
          // We must scope this to the art container because the details section often
          // contains a link to the album ("from the album X") even for tracks.
          const artLink = item.querySelector('.collection-item-art-container a');
          
          if (artLink) {
            const href = artLink.getAttribute('href');
            // If the main link goes to /album/, it's an album.
            // Tracks almost always link to /track/.
            if (href && href.includes('/album/')) {
              isAlbum = true;
            }
          }
        }
        
        if (isAlbum) {
          item.classList.add('bandcamp-workflow-album');
        } else {
          item.classList.remove('bandcamp-workflow-album');
        }
      });
      
      // Extract and store trackIds for each item, and attach play listeners
      BandcampFacade._wishlistItems.forEach((item, index) => {
        this.extractTrackId(item, index);
        
        // Attach listener to update index on manual play
        const playButton = this.findPlayButton(item);
        if (playButton) {
          // Use a data attribute to prevent attaching multiple listeners
          if (!playButton.getAttribute('data-bcwf-play-listener')) {
            const listener = (event: MouseEvent) => {
              // Check if we're currently doing programmatic navigation
              if (BandcampFacade._programmaticNavigationInProgress) {
                Logger.debug('=== PROGRAMMATIC CLICK DETECTED - IGNORING ===');
                Logger.debug(`Programmatic click on item ${index} - not treating as manual play`);
                return;
              }
              
              // Check if the click is directly on the button or a child element that should trigger play
              // This helps avoid unintended index updates from clicks elsewhere in the item
              const target = event.target as HTMLElement;
              Logger.debug('=== MANUAL PLAY BUTTON CLICK DETECTED ===');
              Logger.debug(`Click target: ${target.tagName}.${target.className}`);
              Logger.debug(`Play button: ${playButton.tagName}.${playButton.className}`);
              Logger.debug(`Contains target: ${playButton.contains(target)}`);
              Logger.debug(`Item index: ${index}`);
              Logger.debug(`Current shuffle state: ${ShuffleService.isShuffleEnabled}`);
              
              if (playButton.contains(target)) {
                Logger.debug(`=== VALID MANUAL PLAY DETECTED ===`);
                Logger.debug(`Manual play detected on wishlist item index: ${index}`);
                BandcampFacade._currentWishlistIndex = index;
                // Update shuffle position for the manual selection
                ShuffleService.updateShufflePosition(this.pageType, BandcampFacade._wishlistItems.length, index);
                // Ensure continuous playback listeners are (re)attached after a short delay
                // in case Bandcamp swaps the audio element on play.
                setTimeout(() => BandcampFacade.setupWishlistContinuousPlayback(), 50);
                // Let Bandcamp's default behavior handle the actual playback.
              } else {
                Logger.debug(`=== CLICK OUTSIDE PLAY BUTTON - IGNORED ===`);
              }
            };
            playButton.addEventListener('click', listener);
            playButton.setAttribute('data-bcwf-play-listener', 'true'); // Mark as attached
          }
        }
      });
      
      // Reset current index if we're loading a completely different set of items
      // This happens when navigating between wishlist and collection pages
      if (BandcampFacade._currentWishlistIndex >= BandcampFacade._wishlistItems.length) {
        Logger.debug(`Resetting current index (was ${BandcampFacade._currentWishlistIndex}, but only have ${BandcampFacade._wishlistItems.length} items)`);
        BandcampFacade._currentWishlistIndex = -1;
      }
      
      // Try to find the currently playing track in the new item array
      // This helps maintain proper navigation after page switches
      if (BandcampFacade._currentWishlistIndex < 0) {
        const audio = AudioUtils.getAudioElement();
        if (audio && audio.src && !audio.paused) {
          // Extract track ID from the current audio source
          let currentTrackId: string | null = null;
          if (audio.src.includes('track_id=')) {
            const urlParams = new URLSearchParams(audio.src.split('?')[1]);
            currentTrackId = urlParams.get('track_id');
          }
          
          if (currentTrackId) {
            // Find this track in the current item array
            const matchingIndex = BandcampFacade._wishlistItems.findIndex(item => 
              item.getAttribute('data-track-id') === currentTrackId
            );
            
            if (matchingIndex >= 0) {
              Logger.debug(`Found currently playing track at index ${matchingIndex} in new item array`);
              BandcampFacade._currentWishlistIndex = matchingIndex;
            } else {
              Logger.debug(`Currently playing track not found in current page items`);
            }
          }
        }
      }
      
      Logger.debug(`Found ${BandcampFacade._wishlistItems.length} playable items`);
      
      // Update shuffle order if shuffle mode is enabled and new items were loaded
      if (ShuffleService.isShuffleEnabled) {
        Logger.debug(`Shuffle mode enabled, updating shuffle order for ${this.pageType} page with ${BandcampFacade._wishlistItems.length} total items`);
        ShuffleService.updateShuffleOrderForNewItems(this.pageType, BandcampFacade._wishlistItems.length, BandcampFacade._currentWishlistIndex >= 0 ? BandcampFacade._currentWishlistIndex : 0);
      }
      
      return BandcampFacade._wishlistItems;
    } catch (error) {
      ErrorHandler.withErrorHandling(() => {
        throw error; 
      }, 'Error loading items');
      return [];
    }
  }
  
  /**
   * Extract the track ID from a wishlist item and store it
   *
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
          const url = albumLinks[0].getAttribute('href') || '';
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
            const url = trackLinks[0].getAttribute('href') || '';
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
            const jsonData = JSON.parse(script.textContent || '');
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
        Array.from(item.attributes).forEach((attr) => {
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
            Logger.debug(`Found potential track ID in data attribute ${attrName}: ${attrValue}`);
            break;
          }
        }
      }
      
      // Store the track ID as a data attribute on the item element
      if (trackId) {
        item.setAttribute('data-track-id', trackId);
      } else {
        // Generate a fallback ID
        const uniqueId = `generated-${index}-${Date.now()}`;
        item.setAttribute('data-generated-id', uniqueId);
        Logger.debug(`Could not find track ID for item ${index}`);
        
        // Store any URLs we found as data attributes for fallback
        if (!item.hasAttribute('data-track-href')) {
          const anyLink = item.querySelector('a');
          if (anyLink) {
            item.setAttribute('data-track-href', anyLink.getAttribute('href') || '');
          }
        }
      } 
    } catch (error) {
      ErrorHandler.withErrorHandling(() => {
        throw error; 
      }, `Error extracting track ID for item ${index}`);
    }
  }

  /**
   * Play a specific track from the wishlist
   *
   * @param index Index of the track to play
   */
  public static playWishlistTrack(index: number): void {
    const startTime = Logger.startTiming('playWishlistTrack');
    
    if (!BandcampFacade.isCollectionBasedPage || BandcampFacade._wishlistItems.length === 0) {
      Logger.warn('Cannot play wishlist track - not on collection-based page or no items loaded');
      Logger.timing('playWishlistTrack failed - invalid state', startTime);
      return;
    }

    try {
      // Safety check and correction for invalid indices
      if (index < 0) {
        Logger.warn(`Track index ${index} is negative, correcting to 0 (first track)`);
        index = 0;
      } else if (index >= BandcampFacade._wishlistItems.length) {
        Logger.warn(`Track index ${index} is out of bounds (0-${BandcampFacade._wishlistItems.length - 1}), correcting to last track`);
        index = BandcampFacade._wishlistItems.length - 1;
      }

      const item = BandcampFacade._wishlistItems[index];
      
      // Debug: Log item info for shuffle debugging
      if (ShuffleService.isShuffleEnabled) {
        const trackId = item?.getAttribute('data-track-id') || item?.getAttribute('data-generated-id') || 'unknown';
        Logger.debug(`Playing track ${index + 1}, trackId: ${trackId}, item exists: ${!!item}`);
      }
      
      // Store the current index
      BandcampFacade._currentWishlistIndex = index;
      
      Logger.debug(`Attempting to play wishlist track ${index + 1} of ${BandcampFacade._wishlistItems.length}`);
      Logger.timing('playWishlistTrack setup completed', startTime);
      
      // Try to find and click the play button directly
      const playButtonSearchStart = Logger.startTiming('Finding play button');
      const playButton = this.findPlayButton(item);
      Logger.timing('Play button search completed', playButtonSearchStart);
      
      if (playButton) {
        const playClickStart = Logger.startTiming('Play button click');
        Logger.debug(`Found play button for wishlist track ${index + 1}, clicking it`);
        Logger.debug(`Play button element: ${playButton.tagName} with classes: ${playButton.className}`);
        
        // Set flag to indicate this is a programmatic click (not manual user click)
        BandcampFacade._programmaticNavigationInProgress = true;
        Logger.debug('=== SETTING PROGRAMMATIC NAVIGATION FLAG ===');
        
        // Small delay to ensure flag is set before click
        setTimeout(() => {
          try {
            playButton.click();
            Logger.debug('Play button click executed successfully');
          } catch (error) {
            Logger.error('Error clicking play button:', error);
          }
        }, 10);
        
        // Clear the programmatic flag after a short delay to allow the click event to be processed
        setTimeout(() => {
          BandcampFacade._programmaticNavigationInProgress = false;
          Logger.debug('=== CLEARING PROGRAMMATIC NAVIGATION FLAG ===');
        }, 50);
        
        Logger.timing('Play button clicked', playClickStart);
        
        // Ensure the track item is visible on screen
        this.ensureTrackVisible(item);
        
        // For the first track, give a small delay to allow audio initialization
        const isFirstTrack = index === 0;
        const startVerification = () => {
          const verificationStart = Logger.startTiming('Event-based playback verification');
          this.verifyPlaybackWithEvents(index, verificationStart, startTime);
        };
        
        if (isFirstTrack) {
          setTimeout(startVerification, 50);
        } else {
          startVerification();
        }
        
        return;
      }
      
      // No play button found, try to click an item to select it
      Logger.debug(`No play button found for track ${index + 1}, trying to click the item itself`);
      
      // Debug: Additional info when no play button found in shuffle mode
      if (ShuffleService.isShuffleEnabled) {
        const trackId = item?.getAttribute('data-track-id') || item?.getAttribute('data-generated-id') || 'unknown';
        Logger.warn(`No play button found for track ${index + 1} (trackId: ${trackId}). Item HTML: ${item?.outerHTML?.substring(0, 200)}...`);
      }
      
      // Try to find any clickable element
      const elementSearchStart = Logger.startTiming('Finding clickable elements');
      const clickableElements = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.CLICKABLE_ELEMENTS, item);
      Logger.timing('Clickable elements search completed', elementSearchStart);
      
      if (clickableElements.length > 0) {
        const elementSelectionStart = Logger.startTiming('Element selection');
        // Try to click the first element that isn't an explicit "add to cart" or "share" button
        let clicked = false;
        
        for (let i = 0; i < clickableElements.length; i++) {
          const element = clickableElements[i] as HTMLElement;
          const text = element.textContent?.toLowerCase() || '';
          
          if (!text.includes('buy') && !text.includes('share') && !text.includes('wishlist')) {
            Logger.debug(`Clicking element to select track: "${text.substring(0, 50)}..."`);
            const elementClickStart = Logger.startTiming('Element click');
            element.click();
            Logger.timing('Element clicked', elementClickStart);
            clicked = true;
            Logger.timing('Element selection completed', elementSelectionStart);
            
            // Ensure the track item is visible on screen
            this.ensureTrackVisible(item);
            
            // Phase 2: Smart delay reduction - try immediate and fallback with minimal delay
            const isFirstTrack = index === 0;
            const tryFocusedPlayButton = () => {
              const focusedPlaySearchStart = Logger.startTiming('Finding focused play button');
              const playButton = document.querySelector('.carousel-player-inner .playbutton, .play-button');
              Logger.timing('Focused play button search completed', focusedPlaySearchStart);
              
              if (playButton) {
                const focusedPlayClickStart = Logger.startTiming('Focused play button click');
                Logger.debug('Found play button in focused track, clicking it');
                
                // Set flag to indicate this is a programmatic click (not manual user click)
                BandcampFacade._programmaticNavigationInProgress = true;
                Logger.debug('=== SETTING PROGRAMMATIC NAVIGATION FLAG (FOCUSED) ===');
                
                (playButton as HTMLElement).click();
                
                // Clear the programmatic flag after a short delay to allow the click event to be processed
                setTimeout(() => {
                  BandcampFacade._programmaticNavigationInProgress = false;
                  Logger.debug('=== CLEARING PROGRAMMATIC NAVIGATION FLAG (FOCUSED) ===');
                }, 50);
                
                Logger.timing('Focused play button clicked', focusedPlayClickStart);
                
                // For the first track, give a small delay to allow audio initialization
                const startFocusedVerification = () => {
                  const focusedVerificationStart = Logger.startTiming('Focused event-based playback verification');
                  this.verifyPlaybackWithEvents(index, focusedVerificationStart, startTime);
                };
                
                if (isFirstTrack) {
                  setTimeout(startFocusedVerification, 50);
                } else {
                  startFocusedVerification();
                }
                return true;
              }
              return false;
            };
            
            // Try immediately first (Phase 2 optimization)
            if (!tryFocusedPlayButton()) {
              // Fallback with minimal delay if DOM needs time to update
              setTimeout(() => {
                if (!tryFocusedPlayButton()) {
                  Logger.debug('No play button found after selection, moving to next track');
                  Logger.timing('playWishlistTrack failed - no focused play button', startTime);
                  this.playNextWishlistTrack();
                }
              }, 100); // Reduced from 250ms to 100ms
            }
            
            break;
          }
        }
        
        if (!clicked) {
          Logger.debug('No suitable clickable element found, moving to next track');
          Logger.timing('Element selection failed - no suitable elements', elementSelectionStart);
          Logger.timing('playWishlistTrack failed - no suitable clickable elements', startTime);
          this.playNextWishlistTrack();
        }
      } else {
        Logger.debug('No clickable elements found, moving to next track');
        Logger.timing('playWishlistTrack failed - no clickable elements', startTime);
        this.playNextWishlistTrack();
      }
    } catch (error) {
      ErrorHandler.withErrorHandling(() => {
        throw error; 
      }, 'Error playing wishlist track');
      Logger.timing('playWishlistTrack failed - exception thrown', startTime);
      // On any error, move to the next track (Phase 2: reduced delay for faster recovery)
      setTimeout(() => this.playNextWishlistTrack(), 100); // Reduced from 250ms to 100ms
    }
  }

  /**
   * Play the next track in the wishlist
   */
  public static playNextWishlistTrack(): void {
    const startTime = Logger.startTiming('playNextWishlistTrack');
    
    if (!BandcampFacade.isCollectionBasedPage || BandcampFacade._wishlistItems.length === 0) {
      Logger.timing('playNextWishlistTrack failed - invalid state', startTime);
      return;
    }

    // Check if we already have a pending next track request
    if (BandcampFacade._pendingNextTrackRequest || BandcampFacade._skipInProgress) {
      Logger.debug('Already processing a track change request, ignoring additional request');
      Logger.timing('playNextWishlistTrack blocked - concurrent request', startTime);
      return;
    }

    // Set a flag to prevent multiple concurrent skip requests
    BandcampFacade._pendingNextTrackRequest = true;
    BandcampFacade._skipInProgress = true;
    Logger.timing('playNextWishlistTrack flags set', startTime);

    // Use a reduced delay since event-based verification is faster
    setTimeout(() => {
      const delayCompleteTime = Logger.startTiming('⏰ Initial delay completed');
      
      let nextIndex: number;
      
      Logger.debug('=== FACADE: Determining next track index ===');
      Logger.debug(`Current index: ${BandcampFacade._currentWishlistIndex}`);
      Logger.debug(`Total items: ${BandcampFacade._wishlistItems.length}`);
      Logger.debug(`Shuffle enabled: ${ShuffleService.isShuffleEnabled}`);
      
      if (ShuffleService.isShuffleEnabled) {
        // Use shuffle service to get next track
        nextIndex = ShuffleService.getNextShuffledIndex(this.pageType, BandcampFacade._wishlistItems.length, BandcampFacade._currentWishlistIndex);
        
        // Debug: Check if shuffle returned a valid index
        if (nextIndex < 0 || nextIndex >= BandcampFacade._wishlistItems.length) {
          Logger.warn(`Invalid index returned ${nextIndex} (valid range: 0-${BandcampFacade._wishlistItems.length - 1})`);
        }
        if (nextIndex === BandcampFacade._currentWishlistIndex) {
          Logger.warn(`Same index returned ${nextIndex} (current: ${BandcampFacade._currentWishlistIndex})`);
        }
      } else {
        // Regular sequential navigation
        nextIndex = BandcampFacade._currentWishlistIndex + 1;
        if (nextIndex >= BandcampFacade._wishlistItems.length) {
          nextIndex = 0; // Loop back to the first track
        }
      }

      Logger.debug(`Playing next wishlist track (${nextIndex + 1} of ${BandcampFacade._wishlistItems.length})${ShuffleService.isShuffleEnabled ? ' [SHUFFLE]' : ''}`);
      Logger.timing('Next index calculated', delayCompleteTime);
      
      const playTrackStart = Logger.startTiming('Calling playWishlistTrack');
      this.playWishlistTrack(nextIndex);
      Logger.timing('playWishlistTrack call completed', playTrackStart);
      
      // Phase 2: Optimized flag clearing with reduced delays
      setTimeout(() => {
        const firstClearTime = Logger.startTiming('🏁 First flag clear');
        BandcampFacade._pendingNextTrackRequest = false;
        Logger.timing('Pending flag cleared', firstClearTime);
        
        // Phase 2: Reduced delay for skip flag (350ms vs 500ms)
        setTimeout(() => {
          const secondClearTime = Logger.startTiming('🏁 Skip flag clear');
          BandcampFacade._skipInProgress = false;
          Logger.timing('Skip flag cleared', secondClearTime);
          Logger.timing('playNextWishlistTrack fully completed', startTime);
        }, 350); // Reduced from 500ms to 350ms
      }, 150); // Reduced from 250ms to 150ms
    }, 100); // Phase 2: Reduced initial delay from 250ms to 100ms
  }

  /**
   * Play the previous track in the wishlist
   */
  public static async playPreviousWishlistTrack(): Promise<void> {
    const startTime = Logger.startTiming('playPreviousWishlistTrack');
    
    if (!BandcampFacade.isCollectionBasedPage || BandcampFacade._wishlistItems.length === 0) {
      Logger.timing('playPreviousWishlistTrack failed - invalid state', startTime);
      return;
    }

    // Check if we already have a pending track request
    if (BandcampFacade._pendingNextTrackRequest || BandcampFacade._skipInProgress) {
      Logger.debug('Already processing a track change request, ignoring additional request');
      Logger.timing('playPreviousWishlistTrack blocked - concurrent request', startTime);
      return;
    }

    // Set a flag to prevent multiple concurrent skip requests
    BandcampFacade._pendingNextTrackRequest = true;
    BandcampFacade._skipInProgress = true;
    Logger.timing('playPreviousWishlistTrack flags set', startTime);

    // Phase 2: Reduced initial delay from 250ms to 100ms
    setTimeout(async () => {
      const delayCompleteTime = Logger.startTiming('⏰ Initial delay completed');
      
      // If we're trying to go to the previous track from the first track (index 0),
      // ensure all wishlist items are loaded to get the correct "last" track
      if (BandcampFacade._currentWishlistIndex === 0) {
        Logger.debug('At first track, ensuring all wishlist items are loaded before going to last track');
        const loadAllStart = Logger.startTiming('📥 Loading all wishlist items');
        try {
          const loadSuccess = await this.loadAllWishlistItems();
          Logger.timing('loadAllWishlistItems completed', loadAllStart);
          
          if (loadSuccess) {
            const reloadStart = Logger.startTiming('Reloading wishlist items');
            // Reload wishlist items to get the updated array
            this.loadWishlistItems();
            Logger.debug(`Updated wishlist items count: ${BandcampFacade._wishlistItems.length}`);
            Logger.timing('Wishlist items reloaded', reloadStart);
          } else {
            Logger.warn('Failed to load all wishlist items, using current list');
          }
        } catch (error) {
          Logger.warn('Error loading all wishlist items, using current list:', error);
          Logger.timing('loadAllWishlistItems failed', loadAllStart);
        }
      }
      Logger.timing('Previous track preparation completed', delayCompleteTime);

      let prevIndex: number;
      
      Logger.debug('=== FACADE: Determining previous track index ===');
      Logger.debug(`Current index: ${BandcampFacade._currentWishlistIndex}`);
      Logger.debug(`Total items: ${BandcampFacade._wishlistItems.length}`);
      Logger.debug(`Shuffle enabled: ${ShuffleService.isShuffleEnabled}`);
      
      if (ShuffleService.isShuffleEnabled) {
        // Use shuffle service to get previous track
        prevIndex = ShuffleService.getPreviousShuffledIndex(this.pageType, BandcampFacade._wishlistItems.length, BandcampFacade._currentWishlistIndex);
        
        // Debug: Check if shuffle returned a valid index
        if (prevIndex < 0 || prevIndex >= BandcampFacade._wishlistItems.length) {
          Logger.warn(`Invalid previous index returned ${prevIndex} (valid range: 0-${BandcampFacade._wishlistItems.length - 1})`);
        }
        if (prevIndex === BandcampFacade._currentWishlistIndex) {
          Logger.warn(`Same previous index returned ${prevIndex} (current: ${BandcampFacade._currentWishlistIndex})`);
        }
      } else {
        // Sequential behavior
        prevIndex = BandcampFacade._currentWishlistIndex - 1;
        if (prevIndex < 0) {
          prevIndex = BandcampFacade._wishlistItems.length - 1; // Loop back to the last track
        }
      }

      // Check if the previous track is in our problem list
      const problemCheckStart = Logger.startTiming('Problem track check');
      const item = BandcampFacade._wishlistItems[prevIndex];
      const trackId = item?.getAttribute('data-track-id');
      Logger.timing('Problem track check completed', problemCheckStart);
      
      if (trackId && BandcampFacade._problemTrackIds.has(trackId)) {
        Logger.debug(`Previous track (${prevIndex + 1}) has known issues, skipping it`);
        
        const skipProblemStart = Logger.startTiming('Skipping problem tracks');
        // Calculate the next valid previous index
        let nextValidPrevIndex = prevIndex - 1;
        if (nextValidPrevIndex < 0) {
          nextValidPrevIndex = BandcampFacade._wishlistItems.length - 1;
        }
        
        // Recursively try to find a valid previous track
        let attemptsLeft = BandcampFacade._wishlistItems.length; // Prevent infinite loop
        let foundValidTrack = false;
        
        while (attemptsLeft > 0 && !foundValidTrack) {
          const candidateItem = BandcampFacade._wishlistItems[nextValidPrevIndex];
          const candidateTrackId = candidateItem?.getAttribute('data-track-id');
          
          if (!candidateTrackId || !BandcampFacade._problemTrackIds.has(candidateTrackId)) {
            // Found a track that's not in our problem list
            prevIndex = nextValidPrevIndex;
            foundValidTrack = true;
            Logger.debug(`Found valid previous track at index ${prevIndex + 1}`);
          } else {
            // This track is also problematic, go to previous one
            nextValidPrevIndex--;
            if (nextValidPrevIndex < 0) {
              nextValidPrevIndex = BandcampFacade._wishlistItems.length - 1;
            }
            attemptsLeft--;
          }
        }
        Logger.timing('Problem track skipping completed', skipProblemStart);
        
        if (!foundValidTrack) {
          Logger.warn('Could not find any valid previous tracks, staying on current track');
          BandcampFacade._pendingNextTrackRequest = false;
          BandcampFacade._skipInProgress = false;
          Logger.timing('playPreviousWishlistTrack failed - no valid tracks', startTime);
          return;
        }
      }

      Logger.debug(`Playing previous wishlist track (${prevIndex + 1} of ${BandcampFacade._wishlistItems.length})`);
      const playTrackStart = Logger.startTiming('Calling playWishlistTrack');
      this.playWishlistTrack(prevIndex);
      Logger.timing('playWishlistTrack call completed', playTrackStart);
      
      // Phase 2: Optimized flag clearing with reduced delays
      setTimeout(() => {
        const firstClearTime = Logger.startTiming('🏁 First flag clear');
        BandcampFacade._pendingNextTrackRequest = false;
        Logger.timing('Pending flag cleared', firstClearTime);
        
        // Phase 2: Reduced delay for skip flag (350ms vs 500ms)
        setTimeout(() => {
          const secondClearTime = Logger.startTiming('🏁 Skip flag clear');
          BandcampFacade._skipInProgress = false;
          Logger.timing('Skip flag cleared', secondClearTime);
          Logger.timing('playPreviousWishlistTrack fully completed', startTime);
        }, 350); // Reduced from 500ms to 350ms
      }, 150); // Reduced from 250ms to 150ms
    }, 100); // Phase 2: Reduced initial delay from 250ms to 100ms
  }

  /**
   * Start playing the wishlist from the beginning
   */
  public static startWishlistPlayback(): void {
    if (!BandcampFacade.isCollectionBasedPage) {
      return;
    }

    // Load all wishlist items if not already loaded
    if (BandcampFacade._wishlistItems.length === 0) {
      this.loadWishlistItems();
    }

    if (BandcampFacade._wishlistItems.length > 0) {
      Logger.debug(`Starting wishlist playback with ${BandcampFacade._wishlistItems.length} items`);
      this.playWishlistTrack(0);
    } else {
      Logger.warn('No wishlist items found to play');
    }
  }

  /**
   * Check if currently playing a wishlist track
   */
  public static isPlayingWishlistTrack(): boolean {
    return BandcampFacade.isCollectionBasedPage && BandcampFacade._currentWishlistIndex >= 0;
  }

  /**
   * Setup automatic playback of next track when current track ends
   */
  public static setupWishlistContinuousPlayback(): void {
    if (!BandcampFacade.isCollectionBasedPage) {
      return;
    }

    try {
      Logger.debug('Setting up continuous playback for wishlist');
      
      // Wait for the audio element to be created (it might not exist immediately)
      const setupAudioListeners = () => {
        // Find the audio element
        const audio = AudioUtils.getAudioElement();
        if (!audio) {
          Logger.debug('No audio element found yet, will check again soon');
          setTimeout(setupAudioListeners, 500);
          return;
        }
        
        Logger.debug('Found audio element, setting up ended event listener');
        
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
        
        Logger.debug('Continuous playback setup complete');
      };
      
      // Start setting up listeners
      setupAudioListeners();
    } catch (error) {
      ErrorHandler.withErrorHandling(() => {
        throw error; 
      }, 'Error setting up continuous playback');
    }
  }
  
  /**
   * Handler for when a track ends - plays the next track
   */
  private static handleTrackEnded = () => {
    Logger.debug('Track ended, playing next track');
    // Use BandcampFacade instead of this to avoid reference issues
    if (BandcampFacade.isCollectionBasedPage && BandcampFacade._currentWishlistIndex >= 0) {
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
      Logger.debug('Already recovering from an error, ignoring additional error events');
      return;
    }
    
    // Set flag to prevent multiple error handlers from running simultaneously
    BandcampFacade._errorRecoveryInProgress = true;
    
    try {
      Logger.debug('Attempting to recover from audio error');
      
      // Extract track ID from the current URL if possible
      let trackId = null;
      if (audio.src && audio.src.includes('track_id=')) {
        const urlParams = new URLSearchParams(audio.src.split('?')[1]);
        trackId = urlParams.get('track_id');
      }
      
      // If we have a track ID, add it to the problem list
      if (trackId && trackId !== '') {
        Logger.debug(`Adding track ID ${trackId} to problem list due to playback error`);
        BandcampFacade._problemTrackIds.add(trackId);
      }
      
      // Handle specific error types
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            Logger.debug('Network error detected, attempting to reload audio');
            if (!BandcampFacade._skipInProgress) {
              BandcampFacade._skipInProgress = true;
              // Phase 2: Reduced delay for network error recovery (from 500ms to 350ms)
              setTimeout(() => {
                BandcampFacade._skipInProgress = false;
                BandcampFacade._errorRecoveryInProgress = false;
                if (BandcampFacade.isWishlistPage) {
                  BandcampFacade.playNextWishlistTrack();
                }
              }, 350); // Phase 2: Reduced from 500ms to 350ms
            }
            break;
            
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          case MediaError.MEDIA_ERR_DECODE:
            Logger.debug('Media format error detected, skipping to next track immediately');
            if (!BandcampFacade._skipInProgress) {
              BandcampFacade._skipInProgress = true;
              // Phase 2: Reduced delay for media format error recovery (from 500ms to 350ms)
              setTimeout(() => {
                BandcampFacade._skipInProgress = false;
                BandcampFacade._errorRecoveryInProgress = false;
                if (BandcampFacade.isWishlistPage) {
                  BandcampFacade.playNextWishlistTrack();
                }
              }, 350); // Phase 2: Reduced from 500ms to 350ms
            }
            break;
            
          default:
            Logger.debug('Unrecoverable audio error, skipping to next track');
            if (!BandcampFacade._skipInProgress) {
              BandcampFacade._skipInProgress = true;
              // Phase 2: Reduced delay for default error recovery (from 500ms to 350ms)
              setTimeout(() => {
                BandcampFacade._skipInProgress = false;
                BandcampFacade._errorRecoveryInProgress = false;
                if (BandcampFacade.isWishlistPage) {
                  BandcampFacade.playNextWishlistTrack();
                }
              }, 350); // Phase 2: Reduced from 500ms to 350ms
            }
            break;
        }
      } else {
        Logger.debug('Unrecoverable audio error, skipping to next track');
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
   *
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
      Logger.debug(`Created fixed stream URL: ${newUrl}`);
      
      // Set the new URL and attempt playback
      audio.src = newUrl;
      audio.load();
      
      // Give more time for the audio to load and play
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          ErrorHandler.withErrorHandling(() => {
            throw e; 
          }, 'Error playing with fixed URL');
          
          // Try a second approach - create a completely new URL
          const directStreamUrl = `https://bandcamp.com/stream_redirect?enc=mp3-128&track_id=${trackId}&ts=${timestamp}`;
          Logger.debug(`Trying direct stream URL: ${directStreamUrl}`);
          
          audio.src = directStreamUrl;
          audio.load();
          audio.play().catch((innerError) => {
            ErrorHandler.withErrorHandling(() => {
              throw innerError; 
            }, 'Error playing with direct URL');
            
            // Wait longer before giving up on this track
            setTimeout(() => {
              if (audio && !(audio as HTMLAudioElement).paused) {
                Logger.debug('Direct URL approach eventually succeeded');
                BandcampFacade._errorRecoveryInProgress = false;
                BandcampFacade._consecutiveErrors = 0;
              } else {
                Logger.warn('All URL fixes failed, will attempt to skip track');
                
                // Try clicking the play button again as last resort
                const playButton = BandcampFacade.findPlayButton(currentItem);
                if (playButton) {
                  Logger.debug('Trying to recover by clicking play button');
                  
                  // Set flag to indicate this is a programmatic click (not manual user click)
                  BandcampFacade._programmaticNavigationInProgress = true;
                  Logger.debug('=== SETTING PROGRAMMATIC NAVIGATION FLAG (ERROR RECOVERY) ===');
                  
                  playButton.click();
                  
                  // Clear the programmatic flag after a short delay to allow the click event to be processed
                  setTimeout(() => {
                    BandcampFacade._programmaticNavigationInProgress = false;
                    Logger.debug('=== CLEARING PROGRAMMATIC NAVIGATION FLAG (ERROR RECOVERY) ===');
                  }, 50);
                  
                  // Check after a longer delay if this approach worked
                  setTimeout(() => {
                    if (audio && !(audio as HTMLAudioElement).paused) {
                      Logger.debug('Play button click recovery was successful');
                      BandcampFacade._errorRecoveryInProgress = false;
                      BandcampFacade._consecutiveErrors = 0;
                    } else {
                      Logger.warn('Play button click failed to recover playback');
                      // Skip to the next track after a longer delay to avoid race conditions
                      setTimeout(() => {
                        BandcampFacade._errorRecoveryInProgress = false;
                        Logger.debug('Skipping to next track after attempted recovery');
                        BandcampFacade.playNextWishlistTrack();
                      }, 2000);
                    }
                  }, 2000);
                } else {
                  // If all else fails, skip to the next track
                  Logger.debug('Could not recover current track, skipping to next');
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
          Logger.debug('Fixed URL recovery was successful');
          BandcampFacade._errorRecoveryInProgress = false;
          BandcampFacade._consecutiveErrors = 0;
        } else {
          // The check in the error callback will handle this case
          Logger.debug('Waiting for recovery attempt result...');
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
   *
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
      ErrorHandler.withErrorHandling(() => {
        throw error; 
      }, 'Error finding play button');
      return null;
    }
  }
  
  /**
   * Verify if the current wishlist track is playing correctly
   *
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
      Logger.debug(`Track ${index + 1} is playing successfully`);
      // Reset consecutive errors since we have a successful playback
      BandcampFacade._consecutiveErrors = 0;
    } else {
      // Audio is paused - check if it has a valid source and is just loading
      if (audio.src && !audio.src.includes('blob:') && !audio.src.includes('track_id=&')) {
        Logger.debug(`Track ${index + 1} has valid source, waiting for playback to start`);
        // Check again after a short delay in case it's still loading
        setTimeout(() => {
          if (!audio.paused) {
            Logger.debug(`Track ${index + 1} started playing after delay`);
            BandcampFacade._consecutiveErrors = 0;
          } else {
            Logger.warn(`Track ${index + 1} failed to play automatically`);
            BandcampFacade._consecutiveErrors++;
            
            // If we've tried a few times and it's still not playing, move to the next track
            if (BandcampFacade._consecutiveErrors >= BandcampFacade._maxConsecutiveErrors) {
              Logger.warn(`Track ${index + 1} failed ${BandcampFacade._consecutiveErrors} times, skipping to next track`);
              // Add a delay before skipping to avoid race conditions (reduced from 1000ms to 500ms for Phase 1)
              setTimeout(() => {
                this.playNextWishlistTrack();
              }, 500);
            }
          }
        }, 2000);
      } else {
        // The source is invalid
        Logger.warn(`Track ${index + 1} has invalid source: ${audio.src}`);
        BandcampFacade._consecutiveErrors++;
        
        // Try to fix the URL if it's missing the track ID
        if (audio.src.includes('track_id=&') || !audio.src.includes('track_id=')) {
          const currentItem = BandcampFacade._wishlistItems[index];
          if (currentItem) {
            const trackId = currentItem.getAttribute('data-track-id');
            if (trackId) {
              Logger.debug(`Detected stream URL with missing track ID: ${audio.src}`);
              Logger.debug(`Found track ID from collection item: ${trackId}`);
              
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
                Logger.debug(`Fixed stream URL: ${fixedUrl}`);
                
                // Set the new URL and try to play
                audio.src = fixedUrl;
                audio.load();
                audio.play().catch((e) => {
                  Logger.warn(`Error playing audio: ${e.message}`);
                  // If it still fails, skip to next track (reduced from 1000ms to 500ms for Phase 1)
                  setTimeout(() => {
                    this.playNextWishlistTrack();
                  }, 500);
                });
              } catch (error) {
                Logger.error('Error fixing stream URL:', error);
                // Move to the next track (reduced from 1000ms to 500ms for Phase 1)
                setTimeout(() => {
                  this.playNextWishlistTrack();
                }, 500);
              }
            } else {
              Logger.warn(`No track ID available for item ${index}, trying next track`);
              setTimeout(() => {
                this.playNextWishlistTrack();
              }, 500);
            }
          } else {
            Logger.warn(`No wishlist item found at index ${index}, trying next track`);
            setTimeout(() => {
              this.playNextWishlistTrack();
            }, 500);
          }
        } else {
          // URL appears correct but audio isn't playing, skip to next track (reduced from 1000ms to 500ms for Phase 1)
          setTimeout(() => {
            this.playNextWishlistTrack();
          }, 500);
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
    
    // Check if we're on a collection-based page and have a source with missing track ID
    if (BandcampFacade.isCollectionBasedPage && 
        BandcampFacade._currentWishlistIndex >= 0 &&
        audio.src && 
        (audio.src.includes('track_id=&') || !audio.src.includes('track_id='))) {
      Logger.debug('Detected stream URL with missing track ID:', audio.src);
      
      // Get the current item
      const currentItem = BandcampFacade._wishlistItems[BandcampFacade._currentWishlistIndex];
      if (currentItem) {
        // Try to get the track ID
        const trackId = currentItem.getAttribute('data-track-id');
        if (trackId) {
          // Check if it's a known problematic track ID (like 3302866485)
          if (BandcampFacade._problemTrackIds.has(trackId) || trackId === '3302866485') {
            Logger.debug(`Detected known problematic track ID: ${trackId}, skipping track`);
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
          
          Logger.debug('Found track ID from collection item:', trackId);
          
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
            Logger.debug('Fixed stream URL:', fixedUrl);
            
            // Set the new URL and try to play
            audio.src = fixedUrl;
            audio.load();
            audio.play().catch((e) => {
              Logger.warn('Error playing fixed audio:', e);
              
              // Check if this is a 404 error or media format error
              if (e.name === 'NotSupportedError' || 
                 (typeof e === 'object' && e.message && e.message.includes('404'))) {
                Logger.debug('Track may be unavailable (404/NotSupported), adding to problem list');
                BandcampFacade._problemTrackIds.add(trackId);
                
                // Move to next track directly
                setTimeout(() => {
                  BandcampFacade.playNextWishlistTrack();
                }, 500);
              } else {
                // For other errors, try a completely different URL format as last resort
                try {
                  const directStreamUrl = `https://bandcamp.com/stream_redirect?enc=mp3-128&track_id=${trackId}&ts=${timestamp}`;
                  Logger.debug('Trying direct stream URL as last resort:', directStreamUrl);
                  
                  audio.src = directStreamUrl;
                  audio.load();
                  audio.play().catch((directError) => {
                    Logger.warn('Direct stream URL also failed:', directError);
                    
                    // Give up and move to next track
                    setTimeout(() => {
                      BandcampFacade.playNextWishlistTrack();
                    }, 500);
                  });
                } catch (directUrlError) {
                  Logger.error('Error creating direct stream URL:', directUrlError);
                  setTimeout(() => {
                    BandcampFacade.playNextWishlistTrack();
                  }, 500);
                }
              }
            }); 
          } catch (error) {
            ErrorHandler.withErrorHandling(() => {
              throw error; 
            }, 'Error fixing stream URL');
                
            // Move to the next trackif we encounter an error
            setTimeout(() => {
              BandcampFacade.playNextWishlistTrack();
            }, 500);
          }
        } else {
          Logger.warn('No track ID available for current item, trying next track');
          setTimeout(() => {
            BandcampFacade.playNextWishlistTrack();
          }, 500);
        }
      } else {
        Logger.warn('No current wishlist item found, trying next track');
        setTimeout(() => {
          BandcampFacade.playNextWishlistTrack();
        }, 500);
      }
    }
  }

  /**
   * Determine the page type for shuffle service
   */
  private static get pageType(): 'wishlist' | 'collection' {
    // Check URL to determine if we're on wishlist or collection page
    const url = window.location.href;
    if (url.includes('/wishlist')) {
      return 'wishlist';
    } else {
      return 'collection'; // Default to collection for other collection-based pages
    }
  }

  /**
   * Checks if the current track ID is in our known problem list
   */
  private static checkForProblemTrackId(): boolean {
    if (BandcampFacade._currentWishlistIndex >= 0 && BandcampFacade._wishlistItems.length > 0) {
      const currentItem = BandcampFacade._wishlistItems[BandcampFacade._currentWishlistIndex];
      if (currentItem) {
        const trackId = currentItem.getAttribute('data-track-id');
        if (trackId && BandcampFacade._problemTrackIds.has(trackId)) {
          Logger.debug(`Track ID ${trackId} is in our problem list, skipping it`);
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
        Logger.debug(`Adding track ID ${trackId} to problem list`);
        BandcampFacade._problemTrackIds.add(trackId);
        return true;
      }
    }
    return false;
  }

  /**
   * Verify playback using audio events instead of timeouts for faster response
   * This is Phase 1 of the optimization plan - event-based verification (50% time savings)
   *
   * @param index The index of the track that should be playing
   * @param verificationStart Timing object for logging
   * @param startTime Overall timing object for the playWishlistTrack method
   */
  private static verifyPlaybackWithEvents(index: number, verificationStart: any, startTime: any): void {
    const audio = AudioUtils.getAudioElement();
    
    if (!audio) {
      Logger.warn('No audio element found during event-based verification');
      Logger.timing('playWishlistTrack failed - no audio element', startTime);
      this.playNextWishlistTrack();
      return;
    }

    let verificationComplete = false;
    let timeoutId: NodeJS.Timeout;
    
    // First track needs more time to initialize audio system
    const isFirstTrack = index === 0;
    const timeoutMs = isFirstTrack ? 1500 : 750; // Increased timeouts for better reliability

    // Set up success handler for when playback starts
    const onPlaybackSuccess = () => {
      if (verificationComplete) {
        return;
      }
      verificationComplete = true;
      
      clearTimeout(timeoutId);
      cleanup();
      
      // Track successfully playing - no need to add to play history for now
      // TODO: Implement new simplified play history logic
      Logger.debug(`Track ${index + 1} playing via event-based verification`);
      Logger.timing('Event-based verification successful', verificationStart);
      Logger.timing('playWishlistTrack completed successfully', startTime);
    };

    // Set up failure handler for when playback fails
    const onPlaybackFailure = (reason: string) => {
      if (verificationComplete) {
        return;
      }
      verificationComplete = true;
      
      clearTimeout(timeoutId);
      cleanup();
      
      // Enhanced logging for debugging first track issues
      if (Logger.isDebugEnabled() && isFirstTrack) {
        Logger.debug(`Audio state at failure - paused: ${audio.paused}, readyState: ${audio.readyState}, currentTime: ${audio.currentTime}, src: ${audio.src ? 'present' : 'missing'}`);
      }
      
      // Debug: Additional info for shuffle mode failures
      if (ShuffleService.isShuffleEnabled) {
        const item = BandcampFacade._wishlistItems[index];
        const trackId = item?.getAttribute('data-track-id') || item?.getAttribute('data-generated-id') || 'unknown';
        Logger.warn(`Track ${index + 1} failed to play (${reason}). TrackId: ${trackId}, Audio paused: ${audio.paused}, ReadyState: ${audio.readyState}`);
      }
      
      Logger.debug(`Track ${index + 1} failed to play: ${reason}`);
      Logger.timing('Event-based verification failed', verificationStart);
      Logger.timing('playWishlistTrack failed - playback failed', startTime);
      this.playNextWishlistTrack();
    };

    // Event handlers for track verification
    const onPlay = () => {
      // Audio element fired 'play' event, but let's wait for actual data
      if (!audio.paused && audio.readyState >= 2) {
        // Audio is playing and has enough data
        onPlaybackSuccess();
      }
    };

    const onLoadedData = () => {
      // Audio has loaded data - check if it's playing
      if (!audio.paused) {
        onPlaybackSuccess();
      }
    };

    const onCanPlay = () => {
      // Audio can start playing - check if it's actually playing
      if (!audio.paused) {
        onPlaybackSuccess();
      }
    };

    const onTimeUpdate = () => {
      // Audio time is updating, which means it's definitely playing
      if (audio.currentTime > 0 && !audio.paused) {
        onPlaybackSuccess();
      }
    };

    const onError = () => {
      onPlaybackFailure('audio error event');
    };

    const onStalled = () => {
      // Only consider it stalled if it's been a while and we're not playing
      setTimeout(() => {
        if (!verificationComplete && audio.paused) {
          onPlaybackFailure('audio stalled');
        }
      }, 500);
    };

    // Cleanup function to remove all event listeners
    const cleanup = () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('loadeddata', onLoadedData);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', onStalled);
    };

    // Add event listeners
    audio.addEventListener('play', onPlay);
    audio.addEventListener('loadeddata', onLoadedData);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onStalled);

    // Check current state immediately in case audio is already playing
    if (!audio.paused && (audio.readyState >= 2 || audio.currentTime > 0)) {
      onPlaybackSuccess();
      return;
    }

    // Dynamic timeout based on track position - first track gets more time
    timeoutId = setTimeout(() => {
      if (!verificationComplete) {
        // Enhanced logging for timeout debugging
        Logger.debug(`Timeout reached for track ${index + 1} after ${timeoutMs}ms`);
        Logger.debug(`Audio state - paused: ${audio.paused}, readyState: ${audio.readyState}, currentTime: ${audio.currentTime}`);
        Logger.debug(`Audio src: ${audio.src ? 'present' : 'missing'}`);
        
        // Check one more time before giving up
        if (!audio.paused && (audio.readyState >= 2 || audio.currentTime > 0)) {
          Logger.debug('Track actually started playing, accepting late success');
          onPlaybackSuccess();
        } else {
          onPlaybackFailure('timeout - no events received');
        }
      }
    }, timeoutMs);
  }

  /**
   * Ensure the currently playing track item is visible on screen, accounting for sticky headers and footers
   */
  private static ensureTrackVisible(item: HTMLElement): void {
    if (!item) return;
    
    const itemRect = item.getBoundingClientRect();
    const headerHeight = this.getHeaderHeight();
    const footerHeight = this.getFooterHeight();
    const viewportHeight = window.innerHeight;
    
    // Add extra padding when footer is present
    const headerPadding = 20;
    const footerPadding = footerHeight > 0 ? 30 : 20; // More padding when footer is visible
    
    const topBoundary = headerHeight + headerPadding;
    const bottomBoundary = viewportHeight - footerHeight - footerPadding;
    
    // Only scroll if item is not fully visible
    let scrollNeeded = false;
    let scrollOffset = 0;
    
    if (itemRect.top < topBoundary) {
      // Item is hidden behind header or too close to it
      scrollOffset = itemRect.top - topBoundary;
      scrollNeeded = true;
    } else if (itemRect.bottom > bottomBoundary) {
      // Item is below viewport or too close to bottom/footer
      scrollOffset = itemRect.bottom - bottomBoundary;
      scrollNeeded = true;
    }
    
    if (scrollNeeded) {
      Logger.debug(`Scrolling to keep track in view: ${scrollOffset > 0 ? 'down' : 'up'} by ${Math.abs(scrollOffset)}px`);
      window.scrollBy({
        top: scrollOffset,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Get the height of sticky headers
   */
  private static getHeaderHeight(): number {
    let totalHeight = 0;
    
    // Check for the main Bandcamp menubar (appears/disappears on scroll)
    const menubar = document.querySelector('#menubar-vm.fixed') as HTMLElement;
    if (menubar) {
      const menubarRect = menubar.getBoundingClientRect();
      if (menubarRect.top <= 10 && menubarRect.height > 0) {
        totalHeight += menubarRect.height;
      }
    }
    
    // Check for the wishlist/collection page sticky header
    const gridHeader = document.querySelector('#grid-tabs-sticky.fixed') as HTMLElement;
    if (gridHeader) {
      const headerRect = gridHeader.getBoundingClientRect();
      if (headerRect.top <= 10 && headerRect.height > 0) {
        totalHeight += headerRect.height;
      }
    }
    
    // Use fixed fallback value if we can't find any headers
    return totalHeight > 0 ? totalHeight : 60;
  }

  /**
   * Get the height of the bottom footer/player
   */
  private static getFooterHeight(): number {
    // Check for the main carousel player (when music is playing)
    const carouselPlayer = document.querySelector('.carousel-player') as HTMLElement;
    if (carouselPlayer) {
      const rect = carouselPlayer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (rect.bottom >= viewportHeight - 20 && rect.height > 0) {
        return rect.height;
      }
    }
    
    // Check for the carousel player inner container
    const carouselPlayerInner = document.querySelector('.carousel-player-inner') as HTMLElement;
    if (carouselPlayerInner) {
      const rect = carouselPlayerInner.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (rect.bottom >= viewportHeight - 20 && rect.height > 0) {
        return rect.height;
      }
    }
    
    // Check for the Bandcamp player at the bottom of the page
    const player = document.querySelector('#player') as HTMLElement;
    if (player) {
      const playerRect = player.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (playerRect.bottom >= viewportHeight - 20 && playerRect.height > 0) {
        return playerRect.height;
      }
    }
    
    return 0; // No footer detected
  }

  /**
   * Load all wishlist items by clicking the "view all items" button
   *
   * @returns Promise that resolves to true if all items were loaded successfully
   */
  public static async loadAllWishlistItems(): Promise<boolean> {
    if (!BandcampFacade.isWishlistPage) {
      Logger.warn('Not on wishlist page, cannot load all items');
      return false;
    }

    try {
      Logger.debug('Checking if all wishlist items need to be loaded...');
      
      // Focus only on collection and wishlist tabs
      const tabCounts: Record<string, number> = {};
      const tabs = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.TABS);
      
      let activeTabName = '';
      let wishlistTabIsActive = false;
      
      tabs.forEach((tab) => {
        const tabName = tab.getAttribute('data-tab');
        const countElement = tab.querySelector('.count');
        const isActive = tab.classList.contains('active');
        
        // Only process collection and wishlist tabs
        if ((tabName === 'collection' || tabName === 'wishlist') && countElement) {
          const count = parseInt(countElement.textContent || '0', 10);
          if (!isNaN(count)) {
            tabCounts[tabName] = count;
            
            if (isActive) {
              activeTabName = tabName;
              if (tabName === 'wishlist') {
                wishlistTabIsActive = true;
              }
            }
          }
        }
      });
      
      Logger.debug(`Found tabs - collection: ${tabCounts.collection || 0}, wishlist: ${tabCounts.wishlist || 0}, active: ${activeTabName || 'unknown'}`);
      
      // Only proceed with "view all items" logic if wishlist tab is active
      if (!wishlistTabIsActive) {
        Logger.debug('Wishlist tab is not active, skipping "view all items" logic');
        return false;
      }
      
      // Get the expected wishlist count
      const wishlistCount = tabCounts['wishlist'] || 0;
      
      // Check if we already have all items loaded
      const currentItems = this.loadWishlistItems();
      Logger.debug(`Currently loaded items: ${currentItems.length}`);
      
      if (currentItems.length >= wishlistCount && wishlistCount > 0) {
        Logger.debug('All wishlist items already loaded, no need to click "view all"');
        return true;
      }
      
      Logger.debug('Need to load more items, looking for "view all items" button...');
      
      // Look for "show-more" buttons
      const showMoreButtons = Array.from(document.getElementsByClassName('show-more')) as HTMLElement[];
      Logger.debug(`Found ${showMoreButtons.length} buttons with class="show-more"`);
      
      Logger.debug(`Wishlist tab active: ${wishlistTabIsActive}`);
      
      // Find buttons with "view all X items" text
      const itemButtons = showMoreButtons.filter((button) => {
        const text = button.textContent?.trim().toLowerCase() || '';
        return /^view all \d+ items?$/.test(text);
      });
      
      Logger.debug(`Found ${itemButtons.length} buttons with "view all X items" text`);
      
      // Extract counts from button text for sorting
      const buttonDetails = itemButtons.map((button) => {
        const text = button.textContent?.trim().toLowerCase() || '';
        const match = text.match(/view all (\d+) items?/);
        const count = match ? parseInt(match[1], 10) : 0;
        
        return {button, count, text};
      });
      
      Logger.debug('Available item buttons:');
      buttonDetails.forEach((details) => {
        Logger.debug(`- "${details.text}" (count: ${details.count})`);
      });
      
      // Match button with the count that matches the wishlist tab count
      let wishlistButton = buttonDetails.find((details) => details.count === wishlistCount)?.button;
      
      // If we couldn't find a matching button by count, try other approaches
      if (!wishlistButton && buttonDetails.length > 1) {
        Logger.debug('Could not find button with count matching wishlist tab, using position approach');
        
        // On typical Bandcamp profiles, the tabs are: collection, wishlist, followers, following
        // So the second "items" button should be for wishlist if there are two
        if (buttonDetails.length >= 2) {
          // Sort buttons by their numeric count
          const buttonsByCount = showMoreButtons.filter((button) => {
            const text = button.textContent?.trim().toLowerCase() || '';
            return /^view all \d+ items?$/.test(text);
          }).map((button) => {
            const text = button.textContent?.trim().toLowerCase() || '';
            const match = text.match(/view all (\d+) items?/);
            const count = match ? parseInt(match[1], 10) : 999999;
            return {button, count};
          }).sort((a, b) => a.count - b.count);
          
          // Use the button with the smallest count (likely the wishlist)
          if (buttonsByCount.length > 0) {
            wishlistButton = buttonsByCount[0].button;
            Logger.debug(`Found wishlist button by position approach: "${wishlistButton.textContent?.trim()}"`);
          }
        }
      }
      
      if (!wishlistButton) {
        Logger.warn('Could not determine which button is for the wishlist');
        return false;
      }
      
      Logger.debug(`Clicking wishlist button: "${wishlistButton.textContent?.trim()}"`);
      
      // Mask the lazy-load behind a full-viewport overlay so the user never sees
      // the page scrolling. Save the scroll position to restore it afterward.
      const originalScrollPosition = {x: window.scrollX, y: window.scrollY};
      const overlay = this.showWishlistLoadingOverlay();

      try {
        // Expand the wishlist; Bandcamp lazy-renders the rest as we near the bottom.
        wishlistButton.click();
        Logger.debug('Clicked wishlist "view all items" button');

        const items = await this.scrollLoadWishlistItems(wishlistCount);
        Logger.debug(`Final result: loaded ${items.length}/${wishlistCount} wishlist items`);

        // Return true if we got at least the expected count
        return items.length >= wishlistCount;
      } catch (clickError) {
        Logger.warn('Error expanding wishlist:', clickError);
        return false;
      } finally {
        // The overlay hid all movement, so restoring is instant (no smooth bounce).
        window.scrollTo(originalScrollPosition.x, originalScrollPosition.y);
        this.hideWishlistLoadingOverlay(overlay);
      }
    } catch (error) {
      Logger.error('Error loading all wishlist items:', error);
      return false;
    }
  }

  /**
   * Progressively load all lazy-rendered wishlist items by pinning the page to its
   * growing bottom (Bandcamp fetches the next batch as the bottom enters view).
   * Only ever scrolls DOWN, never bounces to the top; resolves as soon as the
   * target count is reached or the item count stops growing.
   */
  private static async scrollLoadWishlistItems(targetCount: number): Promise<HTMLElement[]> {
    const SETTLE_MS = 350;       // pause between batches for Bandcamp to render
    const MAX_STALL_ROUNDS = 4;  // stop after this many rounds with no new items
    const MAX_ROUNDS = 40;       // hard ceiling for very large wishlists

    const docHeight = (): number => Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
    );

    let items = this.loadWishlistItems();
    let lastCount = items.length;
    let stallRounds = 0;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (items.length >= targetCount) {
        break;
      }

      // Pin to the (growing) bottom to trigger the next lazy batch.
      window.scrollTo(0, docHeight());
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

      items = this.loadWishlistItems();
      if (items.length > lastCount) {
        lastCount = items.length;
        stallRounds = 0;
      } else if (++stallRounds >= MAX_STALL_ROUNDS) {
        Logger.debug(`Wishlist load stalled at ${items.length}/${targetCount}`);
        break;
      }
    }

    return items;
  }

  /**
   * Create and show a full-viewport overlay that masks the wishlist lazy-load so
   * the page scrolling is invisible. Idempotent: reuses an existing overlay.
   */
  private static showWishlistLoadingOverlay(): HTMLElement {
    const existing = document.querySelector(`.${WISHLIST_LOADING_CLASS}`);
    if (existing) {
      return existing as HTMLElement;
    }

    const colors = BandcampFacade.colors;
    const bg = colors?.bg_color ? `#${colors.bg_color}` : '#ffffff';
    const fg = colors?.text_color ? `#${colors.text_color}` : '#000000';

    const overlay = document.createElement('div');
    overlay.className = WISHLIST_LOADING_CLASS;
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483646',
      `background:${bg}`, `color:${fg}`,
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'gap:18px', 'font-size:15px',
      'opacity:0', 'transition:opacity 0.15s ease',
    ].join(';');

    // Inject the spinner keyframes once.
    if (!document.getElementById('bandcamp-workflow-spin-style')) {
      const style = document.createElement('style');
      style.id = 'bandcamp-workflow-spin-style';
      style.textContent = '@keyframes bandcamp-workflow-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }

    const spinner = document.createElement('div');
    spinner.style.cssText = [
      'width:34px', 'height:34px', 'border-radius:50%',
      `border:3px solid ${fg}`, 'border-right-color:transparent',
      'animation:bandcamp-workflow-spin 0.7s linear infinite',
    ].join(';');

    const label = document.createElement('div');
    label.textContent = 'Loading your wishlist…';
    label.style.opacity = '0.85';

    overlay.appendChild(spinner);
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    // Fade in on the next frame.
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    return overlay;
  }

  /**
   * Fade out and remove the wishlist loading overlay.
   */
  private static hideWishlistLoadingOverlay(overlay: HTMLElement | null): void {
    if (!overlay) {
      return;
    }
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
  }
}
