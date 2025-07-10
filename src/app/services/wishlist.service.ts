import {Logger} from '../utils/logger';
import {DOMSelectors} from '../utils/dom-selectors';
import {AudioUtils} from '../utils/audio-utils';
import {AddToCartUtils} from '../utils/add-to-cart-utils';
import {NotificationService} from './notification.service';

/**
 * Centralized service for all wishlist operations
 * Consolidates duplicate wishlist functionality from various controllers
 */
export class WishlistService {
  /**
   * Unified method to toggle wishlist status via API call
   * Supports multiple input formats for maximum flexibility
   *
   * @param options Configuration object with one of the following formats:
   *   - { trackId, fanId, itemType?, isRemoving? } - Build payload from individual parameters
   *   - { isCurrentlyWishlisted, collectPayload, uncollectPayload, fetchFunction? } - Use string payloads
   * @returns Promise<boolean> indicating success
   */
  static async toggleWishlist(options: {
    // Format 1: Individual parameters (builds payload internally)
    trackId?: string;
    fanId?: string;
    itemType?: string;
    isRemoving?: boolean;
  } | {
    // Format 2: External string payloads
    isCurrentlyWishlisted: boolean;
    collectPayload: string;
    uncollectPayload: string;
    fetchFunction?: typeof fetch;
  }): Promise<boolean> {
    try {
      const fetchFunction = 'fetchFunction' in options ? options.fetchFunction || fetch : fetch;
      let url: string;
      let body: string;

      // Determine which format we're using and prepare the request
      if ('trackId' in options && options.trackId && 'fanId' in options && options.fanId) {
        // Format 1: Build payload from individual parameters
        const { trackId, fanId, itemType = 'track', isRemoving = true } = options;
        const endpoint = isRemoving ? 'uncollect_item_cb' : 'collect_item_cb';
        
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
        
        url = `https://${window.location.host}/${endpoint}`;
        body = payload.toString();
      } else if ('isCurrentlyWishlisted' in options && 'collectPayload' in options && 'uncollectPayload' in options) {
        // Format 2: Use external string payloads
        const { isCurrentlyWishlisted, collectPayload, uncollectPayload } = options;
        const endpoint = isCurrentlyWishlisted ? 'uncollect_item_cb' : 'collect_item_cb';
        url = `https://${window.location.host}/${endpoint}`;
        body = isCurrentlyWishlisted ? uncollectPayload : collectPayload;
      } else {
        throw new Error('Invalid options provided to toggleWishlist');
      }

      // Make the request
      const response = await fetchFunction(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        credentials: 'same-origin',
      });
      
      // Check for 403 Forbidden error indicating insufficient permissions
      if (response.status === 403) {
        Logger.warn('403 Forbidden error detected - likely a custom domain permission issue.');
        
        // Show notification to user suggesting page reload
        NotificationService.error('Unable to toggle wishlist due to permission restrictions. Please reload the page and try again.');
        
        return false; // Return false since we couldn't complete the operation directly
      }
      
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      Logger.error('Error toggling wishlist:', error);
      
      // Check if this is a network error that might indicate permission issues
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        Logger.warn('Network error detected - likely a permission issue.');
        
        // Show notification to user suggesting page reload
        NotificationService.error('Network error occurred while toggling wishlist. Please reload the page and try again.');
      } else {
        // Show generic error notification for other types of errors
        NotificationService.error('An error occurred while toggling wishlist. Please reload the page and try again.');
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
          (wishlistedButton as HTMLElement).click();
          return true;
        } else if (isWishlistButtonVisible) {
          (wishlistButton as HTMLElement).click();
          return true;
        }
        
        // Fallback: try any clickable element inside the container
        const anyClickableButton = collectItemContainer.querySelector('#wishlist-msg, #wishlist-msg .action, #wishlist-msg a, #wishlisted-msg .action, #wishlisted-msg a');
        if (anyClickableButton) {
          (anyClickableButton as HTMLElement).click();
          return true;
        }
        
        // Last resort: click the container if no specific button found
        collectItemContainer.click();
        return true;
      }

      // Second, try to find the specifically styled in-wishlist element in the player
      const inWishlistButton = document.querySelector('.wishlisted-msg a, .wishlisted-msg.collection-btn a');
      if (inWishlistButton) {
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
