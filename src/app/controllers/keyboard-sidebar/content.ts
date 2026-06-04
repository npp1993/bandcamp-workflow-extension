import {BandcampFacade} from '../../facades/bandcamp.facade';
import {ShuffleService} from '../../services/shuffle.service';
import {BulkCartService} from '../../services/bulk-cart.service';
import {Controllers} from '../page.controller';
import {KeyboardSidebarController} from '../keyboard-sidebar.controller';

/**
 * Interface for keyboard shortcut definitions
 */
export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  condition?: () => boolean; // Optional condition for when shortcut is available
  bulkModeOnly?: boolean; // If true, only show when bulk mode is enabled
}

/**
 * Interface for toggle setting definitions
 */
export interface ToggleSetting {
  id: string;
  label: string;
  getter: () => boolean;
  setter: (value: boolean) => void;
  condition?: () => boolean; // Optional condition for when setting is available
  hotkey?: string; // Optional hotkey display for the setting
}

/**
 * Sidebar content definitions (settings + keyboard/bulk shortcuts), extracted from
 * KeyboardSidebarController. Pure data builders; `refresh` re-renders the sidebar.
 */
export class SidebarContent {
  static getToggleSettings(controllers: Controllers, refresh: () => void): ToggleSetting[] {
    const settings: ToggleSetting[] = [];

    // Shuffle setting (available on collection-based pages)
    if (BandcampFacade.isCollectionBasedPage) {
      settings.push({
        id: 'shuffle',
        label: 'Shuffle',
        hotkey: 'Y',
        getter: () => ShuffleService.isShuffleEnabled,
        setter: (value: boolean) => {
          if (value !== ShuffleService.isShuffleEnabled) {
            ShuffleService.toggleShuffle();
            // Immediately update the UI after the state change
            refresh();
          }
        }
      });
    }

    // Bulk mode setting (available on wishlist pages only)
    if (BandcampFacade.isWishlistPage) {
      settings.push({
        id: 'bulk-mode',
        label: 'Bulk Purchase',
        hotkey: 'B',
        getter: () => BulkCartService.isInBulkMode,
        setter: (value: boolean) => {
          if (value !== BulkCartService.isInBulkMode) {
            if (!BulkCartService.isInBulkMode) {
              // Enter bulk mode
              const wishlistItems = BandcampFacade.loadWishlistItems();
              if (wishlistItems.length > 0) {
                BulkCartService.enterBulkMode(wishlistItems);
              }
            } else {
              // Exit bulk mode
              BulkCartService.exitBulkMode();
            }
            // Immediately update the UI after the state change
            refresh();
          }
        }
      });
    }

    return settings;
  }

  static getKeyboardShortcuts(controllers: Controllers, refresh: () => void): KeyboardShortcut[] {
    const shortcuts: KeyboardShortcut[] = [];

    // Universal shortcuts (available on all pages)
    shortcuts.push({
      key: 'Space',
      description: 'Play/Pause',
      action: () => BandcampFacade.togglePlayPause()
    });

    // Track wishlist toggle (not on collection pages)
    if (!BandcampFacade.isCollectionPage) {
      shortcuts.push({
        key: 'W',
        description: BandcampFacade.isWishlistPage ? 'Toggle item wishlist' : 'Toggle track wishlist',
        action: () => {
          // This would call the same logic as the keyboard controller
          if (BandcampFacade.isWishlistPage) {
            BandcampFacade.toggleCurrentTrackWishlist();
          } else if (BandcampFacade.isTrack) {
            BandcampFacade.toggleWishlist();
          }
        }
      });
    }

    // Album wishlist toggle (album pages only)
    if (BandcampFacade.isAlbum) {
      shortcuts.push({
        key: 'Q',
        description: 'Toggle album wishlist',
        action: () => BandcampFacade.toggleWishlist()
      });
    }

    // Navigation shortcuts (only when not in bulk mode and not on individual track pages)
    if ((BandcampFacade.isCollectionBasedPage || BandcampFacade.isAlbum) && !BandcampFacade.isTrack) {
      shortcuts.push({
        key: 'N',
        description: 'Next track',
        action: () => {
          if (BandcampFacade.isCollectionBasedPage) {
            BandcampFacade.playNextWishlistTrack();
          } else {
            BandcampFacade.playNextReleaseTrack();
          }
        },
        condition: () => !BulkCartService.isInBulkMode
      });

      shortcuts.push({
        key: 'P',
        description: 'Previous track',
        action: () => {
          if (BandcampFacade.isCollectionBasedPage) {
            BandcampFacade.playPreviousWishlistTrack();
          } else {
            BandcampFacade.playPreviousReleaseTrack();
          }
        },
        condition: () => !BulkCartService.isInBulkMode
      });
    }

    // Seek shortcuts
    shortcuts.push({
      key: 'H / ←',
      description: 'Seek backward 10s',
      action: () => BandcampFacade.seekBackward()
    });

    shortcuts.push({
      key: 'L / →',
      description: 'Seek forward 10s',
      action: () => BandcampFacade.seekForward()
    });

    shortcuts.push({
      key: 'I',
      description: 'Seek to start',
      action: () => BandcampFacade.seekReset()
    });

    // Speed controls (album/track pages only)
    if (BandcampFacade.isPageSupported && controllers.speed) {
      shortcuts.push({
        key: '↑',
        description: 'Increase speed',
        action: () => controllers.speed?.increase()
      });

      shortcuts.push({
        key: '↓',
        description: 'Decrease speed',
        action: () => controllers.speed?.decrease()
      });

      shortcuts.push({
        key: 'R',
        description: 'Reset speed',
        action: () => controllers.speed?.reset()
      });
    }

    // Add to cart shortcuts (not on collection pages)
    if (!BandcampFacade.isCollectionPage) {
      // C - Add current track to cart (hidden in bulk mode since functionality is overridden)
      shortcuts.push({
        key: 'C',
        description: BandcampFacade.isAlbum ? 'Add current track to cart' : 'Add to cart',
        action: () => BandcampFacade.addCurrentTrackToCart(),
        condition: () => !BulkCartService.isInBulkMode
      });

      // Shift+C - Add to cart & close tab (wishlist and album pages only, hidden in bulk mode)
      if (BandcampFacade.isWishlistPage || BandcampFacade.isAlbum) {
        shortcuts.push({
          key: 'Shift+C',
          description: 'Add to cart & close tab',
          action: () => BandcampFacade.addCurrentTrackToCart(true),
          condition: () => !BulkCartService.isInBulkMode
        });
      }
    }

    // Z - Add album to cart (album pages only)
    if (BandcampFacade.isAlbum) {
      shortcuts.push({
        key: 'Z',
        description: 'Add album to cart',
        action: () => BandcampFacade.addCurrentAlbumToCart()
      });
    }

    // Toggle sidebar
    shortcuts.push({
      key: ',',
      description: 'Toggle sidebar',
      action: () => KeyboardSidebarController.toggleCollapse()
    });

    return shortcuts;
  }

  static getBulkShortcuts(controllers: Controllers, refresh: () => void): KeyboardShortcut[] {
    const bulkShortcuts: KeyboardShortcut[] = [];

    if (BandcampFacade.isWishlistPage) {
      bulkShortcuts.push({
        key: 'N',
        description: 'Next item',
        action: () => BulkCartService.navigateNext()
      });

      bulkShortcuts.push({
        key: 'P',
        description: 'Previous item',
        action: () => BulkCartService.navigatePrevious()
      });

      bulkShortcuts.push({
        key: 'F',
        description: 'Toggle selection',
        action: () => BulkCartService.toggleCurrentSelection()
      });

      bulkShortcuts.push({
        key: 'A',
        description: 'Select all',
        action: () => BulkCartService.selectAllItems()
      });

      bulkShortcuts.push({
        key: 'D',
        description: 'Deselect all',
        action: () => BulkCartService.deselectAllItems()
      });

      bulkShortcuts.push({
        key: 'B / Escape',
        description: 'Exit',
        action: () => {
          BulkCartService.exitBulkMode();
          // Refresh sidebar UI immediately
          refresh();
        }
      });

      bulkShortcuts.push({
        key: 'C',
        description: 'Add selected to cart',
        action: () => {
          if (!BulkCartService.isProcessing) {
            BulkCartService.processSelectedItems();
          }
        }
      });
    }

    return bulkShortcuts;
  }
}
