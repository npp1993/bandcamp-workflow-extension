import {Logger} from '../utils/logger';
import {DOMSelectors} from '../utils/dom-selectors';
import {AudioUtils} from '../utils/audio-utils';
import {AddToCartUtils} from '../utils/add-to-cart-utils';

/**
 * Centralized service for all wishlist operations
 * Consolidates duplicate wishlist functionality from various controllers
 */
export class WishlistService {
  /**
   * Toggle wishlist status via API call
   *
   * @param trackId The track or album ID
   * @param fanId The fan ID
   * @param itemType The type of item ('track' or 'album')
   * @param isRemoving Whether we're removing (true) or adding (false) the item
   * @returns Promise<boolean> indicating success
   */
  static async toggleWishlistViaAPI(
    trackId: string, 
    fanId: string, 
    itemType = 'track',
    isRemoving = true,
  ): Promise<boolean> {
    try {
      const endpoint = isRemoving ? 'uncollect_item_cb' : 'collect_item_cb';
      
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
      const response = await fetch(`https://${window.location.host}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
        credentials: 'same-origin',
      });
      
      // Check for 403 Forbidden error indicating insufficient permissions
      if (response.status === 403) {
        Logger.warn('403 Forbidden error detected in API call - likely a custom domain permission issue. Falling back to track page navigation with wishlist parameter.');
        
        // Get track URL from the current page and open with wishlist parameter
        const currentUrl = window.location.href;
        AddToCartUtils.openWishlistLinkWithWishlist(currentUrl);
        
        return false; // Return false since we couldn't complete the operation directly
      }
      
      const data = await response.json();
      
      return data.ok === true;
    } catch (error) {
      Logger.error('Error toggling wishlist via API:', error);
      
      // Check if this is a network error that might indicate permission issues
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        Logger.warn('Network error detected in API call - likely a permission issue. Falling back to track page navigation with wishlist parameter.');
        
        try {
          // Get track URL from the current page and open with wishlist parameter
          const currentUrl = window.location.href;
          AddToCartUtils.openWishlistLinkWithWishlist(currentUrl);
        } catch (fallbackError) {
          Logger.error('Error in wishlist API fallback:', fallbackError);
        }
      }
      
      return false;
    }
  }

  /**
   * Toggle wishlist with pre-built payload method
   *
   * @param payload The form data payload
   * @param endpoint The API endpoint to use
   * @returns Promise<boolean> indicating success
   */
  static async toggleWishlistWithPayload(payload: URLSearchParams, endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(`https://${window.location.host}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
        credentials: 'same-origin',
      });
      
      // Check for 403 Forbidden error indicating insufficient permissions
      if (response.status === 403) {
        Logger.warn('403 Forbidden error detected in payload call - likely a custom domain permission issue. Falling back to track page navigation with wishlist parameter.');
        
        // Get track URL from the current page and open with wishlist parameter
        const currentUrl = window.location.href;
        AddToCartUtils.openWishlistLinkWithWishlist(currentUrl);
        
        return false; // Return false since we couldn't complete the operation directly
      }
      
      const data = await response.json();
      
      return data.ok === true;
    } catch (error) {
      Logger.error('Error toggling wishlist with payload:', error);
      
      // Check if this is a network error that might indicate permission issues
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        Logger.warn('Network error detected in payload call - likely a permission issue. Falling back to track page navigation with wishlist parameter.');
        
        try {
          // Get track URL from the current page and open with wishlist parameter
          const currentUrl = window.location.href;
          AddToCartUtils.openWishlistLinkWithWishlist(currentUrl);
        } catch (fallbackError) {
          Logger.error('Error in wishlist payload fallback:', fallbackError);
        }
      }
      
      return false;
    }
  }

  /**
   * Toggle wishlist using external payloads for both collect and uncollect
   *
   * @param isCurrentlyWishlisted Whether the item is currently in the wishlist
   * @param collectPayload Payload for adding to wishlist
   * @param uncollectPayload Payload for removing from wishlist
   * @param fetchFunction Optional custom fetch function (defaults to global fetch)
   * @returns Promise<boolean> indicating success
   */
  static async toggleWishlistWithExternalPayload(
    isCurrentlyWishlisted: boolean,
    collectPayload: string,
    uncollectPayload: string,
    fetchFunction: typeof fetch = fetch,
  ): Promise<boolean> {
    try {
      const host = window.location.host;
      const endpoint = isCurrentlyWishlisted ? 'uncollect_item_cb' : 'collect_item_cb';
      const url = `https://${host}/${endpoint}`;
      const body = isCurrentlyWishlisted ? uncollectPayload : collectPayload;

      const request = await fetchFunction(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      // Check for 403 Forbidden error indicating insufficient permissions
      if (request.status === 403) {
        Logger.warn('403 Forbidden error detected - likely a custom domain permission issue. Falling back to track page navigation with wishlist parameter.');
        
        // Get track URL from the current page and open with wishlist parameter
        const currentUrl = window.location.href;
        AddToCartUtils.openWishlistLinkWithWishlist(currentUrl);
        
        return false; // Return false since we couldn't complete the operation directly
      }

      const response = await request.json();
      return response.ok === true;
    } catch (error) {
      Logger.error('Error in toggleWishlistWithExternalPayload:', error);
      
      // Check if this is a network error that might indicate permission issues
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        Logger.warn('Network error detected - likely a permission issue. Falling back to track page navigation with wishlist parameter.');
        
        try {
          // Get track URL from the current page and open with wishlist parameter
          const currentUrl = window.location.href;
          AddToCartUtils.openWishlistLinkWithWishlist(currentUrl);
        } catch (fallbackError) {
          Logger.error('Error in wishlist fallback:', fallbackError);
        }
      }
      
      return false;
    }
  }

  /**
   * Fallback method to find and click wishlist button in the UI
   *
   * @param currentItem The current wishlist item element (optional)
   * @returns boolean indicating if a button was clicked
   */
  static clickWishlistToggleInUI(currentItem?: HTMLElement): boolean {
    try {
      // First, try to find the main wishlist button (for album/release pages)
      const collectItemContainer = document.getElementById('collect-item');
      if (collectItemContainer) {
        // Check if the album is currently in the wishlist by looking for visible elements
        const wishlistedButton = collectItemContainer.querySelector('#wishlisted-msg .action');
        const wishlistButton = collectItemContainer.querySelector('#wishlist-msg');
        
        // Determine which button is currently visible/active
        const isCurrentlyWishlisted = wishlistedButton && 
          (wishlistedButton as HTMLElement).offsetParent !== null &&
          window.getComputedStyle(wishlistedButton as HTMLElement).display !== 'none';
          
        const isWishlistButtonVisible = wishlistButton && 
          (wishlistButton as HTMLElement).offsetParent !== null &&
          window.getComputedStyle(wishlistButton as HTMLElement).display !== 'none';
        
        if (isCurrentlyWishlisted) {
          Logger.info('Album is currently in wishlist, clicking remove button');
          (wishlistedButton as HTMLElement).click();
          return true;
        } else if (isWishlistButtonVisible) {
          Logger.info('Album is not in wishlist, clicking add button');
          (wishlistButton as HTMLElement).click();
          return true;
        }
        
        // Fallback: try any clickable element inside the container
        const anyClickableButton = collectItemContainer.querySelector('#wishlist-msg, #wishlist-msg .action, #wishlist-msg a, #wishlisted-msg .action, #wishlisted-msg a');
        if (anyClickableButton) {
          Logger.info('Found fallback clickable button inside #collect-item, clicking it');
          (anyClickableButton as HTMLElement).click();
          return true;
        }
        
        // Last resort: click the container if no specific button found
        Logger.info('Found #collect-item container but no specific button, clicking container');
        collectItemContainer.click();
        return true;
      }

      // Second, try to find the specifically styled in-wishlist element in the player
      const inWishlistButton = document.querySelector('.wishlisted-msg a, .wishlisted-msg.collection-btn a');
      if (inWishlistButton) {
        Logger.info('Found in-wishlist button in player, clicking it');
        (inWishlistButton as HTMLElement).click();
        return true;
      }

      // Third, try more general wishlist button selectors
      const generalWishlistSelectors = [
        '.collect-item', 
        '.wishlist-button',
        '.add-to-wishlist',
        'button[title*="wishlist"]',
        'a[title*="wishlist"]',
        '.collection-btn',
        'button[title*="Add to wishlist"]',
        'a[title*="Add to wishlist"]',
      ];

      for (const selector of generalWishlistSelectors) {
        const wishlistElement = document.querySelector(selector);
        if (wishlistElement) {
          Logger.info(`Found wishlist button with selector: ${selector}`);
          (wishlistElement as HTMLElement).click();
          return true;
        }
      }

      // If we have a current item, look for wishlist toggle elements within it
      if (currentItem) {
        const wishlistButton = currentItem.querySelector(
          '.wishlisted-msg a, .wishlisted-msg.collection-btn a, ' +
          '.item-collection-controls.wishlisted a, ' + 
          '[title*="Remove this album from your wishlist"], [title*="Remove this track from your wishlist"]',
        );
        
        if (wishlistButton) {
          Logger.info('Found wishlist removal button in current track, clicking it');
          (wishlistButton as HTMLElement).click();
          return true;
        }
      }

      Logger.warn('Could not find any wishlist toggle button to click');
      return false;
    } catch (error) {
      Logger.error('Error clicking wishlist toggle in UI:', error);
      return false;
    }
  }

  /**
   * Update wishlist icons and UI state
   *
   * @param item The wishlist item to update
   * @param isInWishlist Whether the item is in the wishlist or not
   */
  static updateWishlistIcons(item: HTMLElement, isInWishlist: boolean): void {
    Logger.info(`Updating wishlist icons (isInWishlist: ${isInWishlist})`);
    
    try {
      // Find all wishlist-related UI elements
      const heartIcons = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.HEART_WISHLIST_ICONS, item);
      
      // Update heart icons if any
      if (heartIcons.length > 0) {
        heartIcons.forEach((icon) => {
          // Toggle filled/unfilled classes based on wishlist state
          if (isInWishlist) {
            icon.classList.remove('unfilled', 'empty');
            icon.classList.add('filled');
          } else {
            icon.classList.remove('filled');
            icon.classList.add('unfilled', 'empty');
          }
        });
        Logger.info(`Updated ${heartIcons.length} heart icons`);
      }
      
      // Set a custom attribute to track state
      item.setAttribute('data-bcwf-wishlisted', isInWishlist ? 'true' : 'false');
    } catch (error) {
      Logger.error('Error updating wishlist icons:', error);
    }
  }

  /**
   * Extract track information from a wishlist item
   *
   * @param item The wishlist item element
   * @returns Object with track ID, item type, and other metadata
   */
  static extractTrackInfo(item: HTMLElement): {
    trackId: string | null;
    itemType: string;
    hasLink: boolean;
    trackLink: string | null;
  } {
    // Try to find the track ID for this item
    const trackId = item.getAttribute('data-track-id') || 
                    item.getAttribute('data-item-id') || 
                    item.getAttribute('data-tralbum-id');
    
    // Get the item_type (track or album) from URL if possible
    let itemType = 'track'; // Default to track
    let trackLink: string | null = null;
    
    const itemLinks = DOMSelectors.findWithSelectors<HTMLAnchorElement>(DOMSelectors.ALBUM_TRACK_LINKS, item);
    if (itemLinks.length > 0) {
      const href = itemLinks[0].getAttribute('href');
      if (href) {
        trackLink = href;
        if (href.includes('/album/')) {
          itemType = 'album';
        }
      }
    }
    
    return {
      trackId,
      itemType,
      hasLink: trackLink !== null,
      trackLink,
    };
  }

  /**
   * Navigate to track page for wishlist toggle (fallback method)
   *
   * @param item The wishlist item element
   * @param currentWishlistIndex The current track index
   * @returns boolean indicating if navigation was initiated
   */
  static navigateToTrackForWishlistToggle(item: HTMLElement, currentWishlistIndex: number): boolean {
    try {
      const trackInfo = this.extractTrackInfo(item);
      
      if (!trackInfo.hasLink || !trackInfo.trackLink) {
        Logger.warn('No track link found for navigation');
        return false;
      }
      
      Logger.info('No direct wishlist button found, navigating to track page with wishlist parameter:', trackInfo.trackLink);
      
      // Save current position before navigating away
      const audio = AudioUtils.getAudioElement();
      const currentTime = audio ? audio.currentTime : 0;
      
      // Store the current track info in sessionStorage so we can return to it
      sessionStorage.setItem('bandcampPlus_lastTrackIndex', currentWishlistIndex.toString());
      sessionStorage.setItem('bandcampPlus_lastTrackTime', currentTime.toString());
      
      // Navigate to the track page with wishlist parameter where wishlist toggle will be available
      const wishlistUrl = AddToCartUtils.addWishlistParameterToUrl(trackInfo.trackLink);
      window.location.href = wishlistUrl;
      return true;
    } catch (error) {
      Logger.error('Error navigating to track for wishlist toggle:', error);
      return false;
    }
  }
}
