import {BandcampFacade} from '../facades/bandcamp.facade';
import {ShuffleService} from '../services/shuffle.service';
import {BulkCartService} from '../services/bulk-cart.service';
import {Logger} from '../utils/logger';
import {Controllers} from './page.controller';

/**
 * Interface for keyboard shortcut definitions
 */
interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  condition?: () => boolean; // Optional condition for when shortcut is available
  bulkModeOnly?: boolean; // If true, only show when bulk mode is enabled
}

/**
 * Interface for toggle setting definitions
 */
interface ToggleSetting {
  id: string;
  label: string;
  getter: () => boolean;
  setter: (value: boolean) => void;
  condition?: () => boolean; // Optional condition for when setting is available
  hotkey?: string; // Optional hotkey display for the setting
}

/**
 * Controller for managing the keyboard shortcuts and settings sidebars
 */
export class KeyboardSidebarController {
  private static instance: KeyboardSidebarController | null = null;
  private controllers: Controllers;
  private settingsSidebar: HTMLElement | null = null;
  private hotkeysSidebar: HTMLElement | null = null;
  private bulkSidebar: HTMLElement | null = null;
  private isVisible = true;
  
  // Collapse state for each sidebar
  private settingsCollapsed = false;
  private hotkeysCollapsed = false;
  private bulkCollapsed = false;

  constructor(controllers: Controllers) {
    this.controllers = controllers;
    this.init();
  }

  /**
   * Initialize the keyboard sidebar controller
   */
  public static init(controllers: Controllers): KeyboardSidebarController {
    if (!this.instance) {
      this.instance = new KeyboardSidebarController(controllers);
    }
    return this.instance;
  }

  /**
   * Clean up the sidebar controller
   */
  public static cleanup(): void {
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
    }
  }

  /**
   * Toggle sidebar visibility
   */
  public static toggleVisibility(): void {
    if (this.instance) {
      this.instance.toggle();
    }
  }

  /**
   * Force refresh the sidebar UI (for immediate updates when state changes via keyboard)
   */
  public static refreshUI(): void {
    if (this.instance) {
      this.instance.render();
    }
  }

  /**
   * Initialize the sidebars
   */
  private init(): void {
    this.createSidebars();
    this.setupBulkModeListener();
    this.render();
  }

  /**
   * Create both settings and hotkeys sidebars
   */
  private createSidebars(): void {
    // Create settings sidebar (top)
    this.settingsSidebar = document.createElement('div');
    this.settingsSidebar.className = 'bandcamp-workflow-settings-sidebar';
    this.settingsSidebar.style.cssText = this.getSidebarBaseStyles();

    // Create hotkeys sidebar (middle)
    this.hotkeysSidebar = document.createElement('div');
    this.hotkeysSidebar.className = 'bandcamp-workflow-hotkeys-sidebar';
    this.hotkeysSidebar.style.cssText = this.getSidebarBaseStyles();

    // Create bulk purchase sidebar (bottom, hidden by default)
    this.bulkSidebar = document.createElement('div');
    this.bulkSidebar.className = 'bandcamp-workflow-bulk-sidebar';
    this.bulkSidebar.style.cssText = this.getSidebarBaseStyles() + `
      display: none;
    `;

    // Create a container for all sidebars
    const container = document.createElement('div');
    container.className = 'bandcamp-workflow-sidebars-container';
    container.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 15px;
    `;

    container.appendChild(this.settingsSidebar);
    container.appendChild(this.hotkeysSidebar);
    container.appendChild(this.bulkSidebar);
    document.body.appendChild(container);
  }

  /**
   * Get base sidebar styles
   */
  private getSidebarBaseStyles(): string {
    return `
      position: relative;
      z-index: 1000;
      background-color: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid #d3d3d3;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-sizing: border-box;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      width: 250px;
      font-family: Arial, sans-serif;
      font-size: 12px;
    `;
  }

  /**
   * Get available toggle settings for current page
   */
  private getToggleSettings(): ToggleSetting[] {
    const settings: ToggleSetting[] = [];

    // Shuffle setting (available on collection-based pages)
    if (BandcampFacade.isCollectionBasedPage) {
      settings.push({
        id: 'shuffle',
        label: 'Shuffle',
        hotkey: 'S',
        getter: () => ShuffleService.isShuffleEnabled,
        setter: (value: boolean) => {
          if (value !== ShuffleService.isShuffleEnabled) {
            ShuffleService.toggleShuffle();
            // Immediately update the UI after the state change
            this.render();
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
            this.render();
          }
        }
      });
    }

    return settings;
  }

  /**
   * Get available keyboard shortcuts for current page (excluding bulk shortcuts)
   */
  private getKeyboardShortcuts(): KeyboardShortcut[] {
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
    if (BandcampFacade.isPageSupported && this.controllers.speed) {
      shortcuts.push({
        key: '↑',
        description: 'Increase speed',
        action: () => this.controllers.speed?.increase()
      });

      shortcuts.push({
        key: '↓',
        description: 'Decrease speed',
        action: () => this.controllers.speed?.decrease()
      });

      shortcuts.push({
        key: 'R',
        description: 'Reset speed',
        action: () => this.controllers.speed?.reset()
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

    return shortcuts;
  }

  /**
   * Get bulk purchase mode shortcuts
   */
  private getBulkShortcuts(): KeyboardShortcut[] {
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
        action: () => BulkCartService.exitBulkMode()
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

  /**
   * Create a toggle button for a setting (using hotkey sidebar style)
   */
  private createToggleButton(setting: ToggleSetting): HTMLElement {
    const button = document.createElement('button');
    button.className = `bandcamp-workflow-setting-${setting.id}`;
    button.style.cssText = `
      padding: 6px 10px;
      cursor: pointer;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 11px;
      font-weight: normal;
      transition: all 0.2s;
      text-align: left;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const keySpan = document.createElement('span');
    keySpan.textContent = setting.hotkey || '';
    keySpan.style.cssText = `
      font-weight: bold;
      color: #495057;
      min-width: 20px;
    `;

    const descSpan = document.createElement('span');
    descSpan.textContent = setting.label;
    descSpan.style.cssText = `
      flex: 1;
      text-align: right;
    `;

    button.appendChild(keySpan);
    button.appendChild(descSpan);

    const updateButton = () => {
      const isEnabled = setting.getter();
      if (isEnabled) {
        button.style.backgroundColor = '#e3f2fd';
        button.style.borderColor = '#2196f3';
        button.style.color = '#1976d2';
        descSpan.style.fontWeight = 'bold';
      } else {
        button.style.backgroundColor = '#f8f9fa';
        button.style.borderColor = '#dee2e6';
        button.style.color = '#333';
        descSpan.style.fontWeight = 'normal';
      }
    };

    button.addEventListener('click', () => {
      setting.setter(!setting.getter());
      updateButton();
    });

    button.addEventListener('mouseenter', () => {
      if (!setting.getter()) {
        button.style.backgroundColor = '#e9ecef';
      }
    });

    button.addEventListener('mouseleave', () => {
      updateButton();
    });

    updateButton();

    return button;
  }

  /**
   * Create a hotkey button
   */
  private createHotkeyButton(shortcut: KeyboardShortcut): HTMLElement {
    const button = document.createElement('button');
    button.className = `bandcamp-workflow-hotkey-${shortcut.key.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    button.style.cssText = `
      padding: 6px 10px;
      cursor: pointer;
      background-color: #f8f9fa;
      color: #333;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 11px;
      font-weight: normal;
      transition: background-color 0.2s;
      text-align: left;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const keySpan = document.createElement('span');
    keySpan.textContent = shortcut.key;
    keySpan.style.cssText = `
      font-weight: bold;
      color: #495057;
      min-width: 60px;
    `;

    const descSpan = document.createElement('span');
    descSpan.textContent = shortcut.description;
    descSpan.style.cssText = `
      flex: 1;
      text-align: right;
    `;

    button.appendChild(keySpan);
    button.appendChild(descSpan);

    button.addEventListener('click', () => {
      shortcut.action();
    });

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#e9ecef';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#f8f9fa';
    });

    return button;
  }

  /**
   * Create a collapsible title with triangle icon
   */
  private createCollapsibleTitle(text: string, isCollapsed: boolean, onToggle: () => void): HTMLElement {
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      display: flex;
      align-items: center;
      cursor: pointer;
      font-weight: bold;
      font-size: 13px;
      color: #495057;
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 5px;
      margin-bottom: 5px;
      user-select: none;
    `;

    // Create triangle icon
    const triangle = document.createElement('span');
    triangle.style.cssText = `
      margin-right: 6px;
      font-size: 10px;
      transition: transform 0.2s ease;
      transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};
      color: #6c757d;
    `;
    triangle.textContent = '▼';

    // Create title text
    const titleText = document.createElement('span');
    titleText.textContent = text;

    titleContainer.appendChild(triangle);
    titleContainer.appendChild(titleText);

    // Add click handler
    titleContainer.addEventListener('click', () => {
      onToggle();
    });

    // Add hover effect
    titleContainer.addEventListener('mouseenter', () => {
      titleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
      titleContainer.style.borderRadius = '4px';
    });

    titleContainer.addEventListener('mouseleave', () => {
      titleContainer.style.backgroundColor = 'transparent';
      titleContainer.style.borderRadius = '0px';
    });

    return titleContainer;
  }

  /**
   * Render both sidebars
   */
  private render(): void {
    this.renderSettingsSidebar();
    this.renderHotkeysSidebar();
    this.renderBulkSidebar();
  }

  /**
   * Render the settings sidebar
   */
  private renderSettingsSidebar(): void {
    if (!this.settingsSidebar) return;

    this.settingsSidebar.innerHTML = '';

    const settings = this.getToggleSettings();
    if (settings.length === 0) {
      this.settingsSidebar.style.display = 'none';
      return;
    }

    this.settingsSidebar.style.display = 'flex';

    // Add collapsible title
    const title = this.createCollapsibleTitle('Settings', this.settingsCollapsed, () => {
      this.settingsCollapsed = !this.settingsCollapsed;
      this.renderSettingsSidebar();
    });
    this.settingsSidebar.appendChild(title);

    // Add settings (only if not collapsed)
    if (!this.settingsCollapsed) {
      settings.forEach(setting => {
        if (!setting.condition || setting.condition()) {
          this.settingsSidebar!.appendChild(this.createToggleButton(setting));
        }
      });
    }
  }

  /**
   * Render the hotkeys sidebar
   */
  private renderHotkeysSidebar(): void {
    if (!this.hotkeysSidebar) return;

    this.hotkeysSidebar.innerHTML = '';

    const shortcuts = this.getKeyboardShortcuts();
    const isInBulkMode = BulkCartService.isInBulkMode;

    // Filter shortcuts based on conditions and bulk mode
    const visibleShortcuts = shortcuts.filter(shortcut => {
      // Check basic condition
      if (shortcut.condition && !shortcut.condition()) {
        return false;
      }

      // Handle bulk mode visibility
      if (isInBulkMode) {
        // In bulk mode, show bulk mode shortcuts and hide conflicting normal shortcuts
        if (shortcut.bulkModeOnly) {
          return true;
        }
        // Hide normal N/P shortcuts when in bulk mode as they conflict
        if (shortcut.key === 'N' || shortcut.key === 'P') {
          return false;
        }
        return true;
      } else {
        // Not in bulk mode, hide bulk-only shortcuts
        return !shortcut.bulkModeOnly;
      }
    });

    if (visibleShortcuts.length === 0) {
      this.hotkeysSidebar.style.display = 'none';
      return;
    }

    this.hotkeysSidebar.style.display = 'flex';

    // Add collapsible title
    const title = this.createCollapsibleTitle('Hotkeys', this.hotkeysCollapsed, () => {
      this.hotkeysCollapsed = !this.hotkeysCollapsed;
      this.renderHotkeysSidebar();
    });
    this.hotkeysSidebar.appendChild(title);

    // Add shortcuts (only if not collapsed)
    if (!this.hotkeysCollapsed) {
      visibleShortcuts.forEach(shortcut => {
        this.hotkeysSidebar!.appendChild(this.createHotkeyButton(shortcut));
      });
    }
  }

  /**
   * Render the bulk purchase sidebar
   */
  private renderBulkSidebar(): void {
    if (!this.bulkSidebar) return;

    const isInBulkMode = BulkCartService.isInBulkMode;

    if (!isInBulkMode) {
      this.bulkSidebar.style.display = 'none';
      return;
    }

    this.bulkSidebar.style.display = 'flex';
    this.bulkSidebar.innerHTML = '';

    const bulkShortcuts = this.getBulkShortcuts();

    if (bulkShortcuts.length === 0) {
      this.bulkSidebar.style.display = 'none';
      return;
    }

    // Add collapsible title
    const title = this.createCollapsibleTitle('Bulk Purchase', this.bulkCollapsed, () => {
      this.bulkCollapsed = !this.bulkCollapsed;
      this.renderBulkSidebar();
    });
    this.bulkSidebar.appendChild(title);

    // Add bulk shortcuts (only if not collapsed)
    if (!this.bulkCollapsed) {
      bulkShortcuts.forEach(shortcut => {
        this.bulkSidebar!.appendChild(this.createHotkeyButton(shortcut));
      });
    }
  }

  /**
   * Setup page navigation listener to re-render when user navigates between pages
   */
  private setupBulkModeListener(): void {
    let lastPageType = this.getCurrentPageType();
    
    // Poll only for page navigation changes since button clicks and keyboard shortcuts
    // now trigger immediate UI updates
    setInterval(() => {
      const currentPageType = this.getCurrentPageType();
      
      if (currentPageType !== lastPageType) {
        lastPageType = currentPageType;
        this.render();
      }
    }, 250);
  }

  /**
   * Get a string representing the current page type for comparison
   */
  private getCurrentPageType(): string {
    const parts = [];
    if (BandcampFacade.isWishlistPage) parts.push('wishlist');
    if (BandcampFacade.isCollectionPage) parts.push('collection');
    if (BandcampFacade.isAlbum) parts.push('album');
    if (BandcampFacade.isTrack) parts.push('track');
    if (BandcampFacade.isPageSupported) parts.push('supported');
    if (BandcampFacade.isCollectionBasedPage) parts.push('collection-based');
    return parts.join('-') || 'unknown';
  }

  /**
   * Toggle sidebar visibility
   */
  private toggle(): void {
    this.isVisible = !this.isVisible;
    const container = document.querySelector('.bandcamp-workflow-sidebars-container') as HTMLElement;
    if (container) {
      container.style.display = this.isVisible ? 'flex' : 'none';
    }
  }

  /**
   * Destroy the sidebars
   */
  private destroy(): void {
    const container = document.querySelector('.bandcamp-workflow-sidebars-container');
    if (container && container.parentElement) {
      container.parentElement.removeChild(container);
    }
    this.settingsSidebar = null;
    this.hotkeysSidebar = null;
  }
}
