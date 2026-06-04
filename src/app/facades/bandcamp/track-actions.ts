/**
 * Current-track actions: add-to-cart and wishlist toggling.
 *
 * Extracted from BandcampFacade. Covers the cart hotkeys (c/z) and wishlist
 * toggles (w/q) for album/track/wishlist pages. State and DOM access stay on
 * BandcampFacade; this module reaches them via the facade, which keeps thin
 * delegators for the four public entry points.
 */
import {BandcampFacade} from '../bandcamp.facade';
import {Logger} from '../../utils/logger';
import {AddToCartUtils} from '../../utils/add-to-cart-utils';
import {AlbumOnlyUtils} from '../../utils/album-only-utils';
import {ErrorHandler} from '../../utils/error-handler';
import {NotificationService} from '../../services/notification.service';
import {WishlistService} from '../../services/wishlist.service';

export class TrackActions {
  public static toggleWishlist(): void {
    try {
      Logger.debug('Attempting to toggle wishlist for entire release');
      
      // Use centralized wishlist service
      const success = WishlistService.clickWishlistToggleInUI();
      
      if (!success) {
        Logger.warn('Could not find appropriate wishlist button to click');
        
        // Show notification to user suggesting page reload
        NotificationService.warning('Unable to find wishlist button on this page.');
      }
    } catch (error) {
      ErrorHandler.withErrorHandling(() => {
        throw error; 
      }, 'Error in toggleWishlist');
    }
  }

  /**
   * Add the current album to cart (z key functionality)
   */
  public static addCurrentAlbumToCart(): void {
    Logger.debug('z key detected on album page - adding entire album to cart');
    AddToCartUtils.clickAddToCartButtonOnCurrentPage();
  }

  /**
   * Add the current track to cart
   * @param closeTabAfterAdd Whether to close the tab after adding to cart (only applies to wishlist pages)
   */
  public static addCurrentTrackToCart(closeTabAfterAdd = false): void {
    // Special handling for wishlist pages
    if (BandcampFacade.isWishlistPage) {
      // If we have wishlist items but no track is currently playing (index is -1)
      // Simply do nothing as requested
      if (BandcampFacade._currentWishlistIndex < 0) {
        Logger.debug('c key detected - no track selected, ignoring press');
        return;
      }
      
      // Handle case where a track is currently playing (_currentWishlistIndex >= 0)
      if (BandcampFacade._wishlistItems.length > 0) {
        const currentItem = BandcampFacade._wishlistItems[BandcampFacade._currentWishlistIndex];
        if (currentItem) {
          Logger.debug('c key detected - adding current track to cart from wishlist');
          
          // Use the shared method with now-playing check enabled for the current track
          AddToCartUtils.addWishlistItemToCart(currentItem, {
            checkNowPlaying: true,
            logPrefix: closeTabAfterAdd ? 'Shift+c key detected - adding current track to cart from wishlist and closing tab' : 'c key detected - adding current track to cart from wishlist',
            closeTabAfterAdd: closeTabAfterAdd
          }).catch((error) => {
            Logger.error('Failed to add current track to cart:', error);
          });
          return;
        } else {
          Logger.warn('Current wishlist item not found');
        }
      } else {
        Logger.warn('No wishlist items loaded');
      }
    } else if (BandcampFacade.isAlbum) {
      // Special handling for album pages - only add the currently playing track to cart if one is selected
      Logger.debug('c key detected on album page - looking for currently playing track');
      
      // Find the currently playing track row (has 'current_track' class)
      const currentTrackRow = document.querySelector('.track_row_view.current_track');
      
      if (currentTrackRow) {
        Logger.debug('Found currently playing track row, looking for track link');
        
        // Look for the track link within the current track row
        const trackLink = currentTrackRow.querySelector('.title a') as HTMLAnchorElement;
        
        if (trackLink && trackLink.href) {
          Logger.debug('Found track link for currently playing track, opening with cart parameter:', trackLink.href);
          AddToCartUtils.openAddToCartLinkWithCart(trackLink.href, closeTabAfterAdd);
          return;
        } else {
          Logger.warn('Could not find track link in currently playing track row');
        }
      } else {
        Logger.debug('No track currently playing on album page, ignoring c key press');
        return;
      }
    } else if (BandcampFacade.isTrack) {
      // For individual track pages, first check if only album purchase is available
      Logger.debug('c key detected on track page - checking purchase options');
      
      const {isAlbumOnly} = AlbumOnlyUtils.checkForAlbumOnlyPurchase();
      
      if (isAlbumOnly) {
        Logger.debug('Track page only allows album purchase, ignoring c key press as requested');
        return;
      }
      
      // If no album-only indicator found, proceed with normal track purchase
      Logger.debug('No album-only restriction detected, clicking add to cart button to open dialog');
      AddToCartUtils.clickAddToCartButtonOnCurrentPage();
    } else {
      // Fallback for other page types
      Logger.debug('c key detected on unsupported page type - attempting default add to cart action');
      AddToCartUtils.clickAddToCartButtonOnCurrentPage();
    }
  }

  /**
   * Toggle wishlist status for the currently playing track in the wishlist
   */
  public static toggleCurrentTrackWishlist(): void {
    if (!BandcampFacade.isWishlistPage || BandcampFacade._currentWishlistIndex < 0 || !BandcampFacade._wishlistItems.length) {
      Logger.warn('Cannot toggle current track wishlist - not on wishlist page or no track selected');
      return;
    }

    try {
      // Get the current wishlist item
      const currentItem = BandcampFacade._wishlistItems[BandcampFacade._currentWishlistIndex];
      if (!currentItem) {
        Logger.warn('Current wishlist item not found');
        return;
      }
      
      // Extract track information using centralized service
      const trackInfo = WishlistService.extractTrackInfo(currentItem);
      
      if (trackInfo.trackId) {
        Logger.debug(`Found track ID ${trackInfo.trackId} for wishlist toggle`);
        
        // First try to use direct API to toggle wishlist status
        const pageData = document.getElementById('pagedata');
        if (pageData) {
          const dataBlob = pageData.getAttribute('data-blob');
          if (dataBlob) {
            try {
              const data = JSON.parse(dataBlob);
              const fanId = data.fan_id || (data.fan_tralbum_data && data.fan_tralbum_data.fan_id);
              
              if (fanId) {
                Logger.debug(`Found fan ID: ${fanId}, attempting to toggle wishlist via API`);
                
                // Use centralized API method - since we're on wishlist page, we want to remove
                WishlistService.toggleWishlist({
                  trackId: trackInfo.trackId,
                  fanId: fanId.toString(),
                  itemType: trackInfo.itemType,
                  isRemoving: true
                })
                  .then((success: boolean) => {
                    if (success) {
                      Logger.debug('Successfully toggled wishlist status via API!');
                      
                      // Update UI - hide or remove the item since we're on the wishlist page
                      currentItem.style.opacity = '0.5';
                      currentItem.style.transition = 'opacity 0.3s';
                      setTimeout(() => {
                        // Either remove from DOM or hide
                        if (currentItem.parentElement) {
                          currentItem.parentElement.removeChild(currentItem);
                          // Update the wishlist items array
                          BandcampFacade._wishlistItems = BandcampFacade._wishlistItems.filter((item) => item !== currentItem);
                        } else {
                          currentItem.style.display = 'none';
                        }
                      }, 300);
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
   *
   * @param currentItem The current wishlist item element
   */
  private static fallbackToWishlistButtonClick(currentItem: HTMLElement): void {
    Logger.debug('Falling back to wishlist button click method');
    
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
      const navigationSuccess = WishlistService.navigateToTrackForWishlistToggle(currentItem, BandcampFacade._currentWishlistIndex);
      
      if (!navigationSuccess) {
        Logger.warn('Could not find any wishlist toggle or track link for the current track');
      }
    } catch (error) {
      Logger.error('Error in fallbackToWishlistButtonClick:', error);
    }
  }
  
  /**
   * Helper method to update wishlist icons without removing the item
   *
   * @param item The wishlist item to update
   * @param isInWishlist Whether the item is in the wishlist or not
   */
  private static updateWishlistIcons(item: HTMLElement, isInWishlist: boolean): void {
    // Use centralized wishlist service
    WishlistService.updateWishlistIcons(item, isInWishlist);
  }
  
  /**
   * Helper method to handle wishlist item removal UI updates
   *
   * @param item The wishlist item to update UI for
   */
  private static handleWishlistItemRemoval(item: HTMLElement): void {
    Logger.debug('Updating wishlist UI state (not removing item)');
    
    // Just update the wishlist icons instead of removing the item
    this.updateWishlistIcons(item, false);
  }
}
