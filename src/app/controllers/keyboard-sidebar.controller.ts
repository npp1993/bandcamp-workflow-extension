import {BandcampFacade} from '../facades/bandcamp.facade';
import {BulkCartService} from '../services/bulk-cart.service';
import {Logger} from '../utils/logger';
import {Controllers} from './page.controller';
import {SidebarContent} from './keyboard-sidebar/content';
import {SidebarView} from './keyboard-sidebar/view';

/**
 * Controller for managing the keyboard shortcuts and settings sidebars
 */
export class KeyboardSidebarController {
  private static instance: KeyboardSidebarController | null = null;
  private controllers: Controllers;
  private settingsSidebar: HTMLElement | null = null;
  private hotkeysSidebar: HTMLElement | null = null;
  private bulkSidebar: HTMLElement | null = null;
  private sidebarsContainer: HTMLElement | null = null;
  private isVisible = true;
  private static readonly STORAGE_KEY = 'bcks-sidebar-collapsed';
  
  // Collapse state
  private isSidebarsCollapsed = false;
  private static readonly COOKIE_NAME = 'bcks-sidebar-state';

  constructor(controllers: Controllers) {
    this.controllers = controllers;
    this.init();
  }

  /**
   * Initialize the keyboard sidebar controller
   */
  public static init(controllers: Controllers): KeyboardSidebarController {
    // Check if existing instance has valid DOM elements
    if (this.instance) {
      const existingContainer = document.querySelector('.bcks-sidebars-container');
      if (existingContainer) {
        // Instance exists and DOM elements are present, but check if sidebars should be visible on this page
        this.instance.updateVisibilityForCurrentPage();
        return this.instance;
      } else {
        // Instance exists but DOM elements are missing, clean up and recreate
        this.instance = null;
      }
    }
    
    // Create new instance
    this.instance = new KeyboardSidebarController(controllers);
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
    // Don't create sidebars on followers/following pages
    if (BandcampFacade.isFollowersPage || BandcampFacade.isFollowingPage) {
      return;
    }

    // Load persisted state from cookies
    const savedState = this.getCookie(KeyboardSidebarController.COOKIE_NAME);

    if (savedState === 'true') {
      this.isSidebarsCollapsed = true;
    }
    
    this.createSidebars();
    this.setupBulkModeListener();
    this.render();
    this.updateCollapseStateUI();

    // Listen for visibility changes to sync state across tabs
    document.addEventListener('visibilitychange', () => {
      this.syncFromCookie();
    });

    // Also poll for changes every second to handle side-by-side windows where visibility doesn't change
    setInterval(() => {
      this.syncFromCookie();
    }, 1000);
  }

  /**
   * Sync state from cookie
   */
  private syncFromCookie(): void {
    if (document.hidden) return;
    
    const currentCookie = this.getCookie(KeyboardSidebarController.COOKIE_NAME);
    const newState = currentCookie === 'true';
    
    if (this.isSidebarsCollapsed !== newState) {
      this.isSidebarsCollapsed = newState;
      this.updateCollapseStateUI();
    }
  }

  /**
   * Get cookie value
   */
  private getCookie(name: string): string | null {
    try {
      const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
      return v ? v[2] : null;
    } catch (e) {
      Logger.error('Error reading cookie:', e);
      return null;
    }
  }

  /**
   * Set cookie value with domain handling for Bandcamp subdomains
   */
  private setCookie(name: string, value: string, days: number): void {
    try {
      const d = new Date();
      d.setTime(d.getTime() + 24 * 60 * 60 * 1000 * days);
      
      let domainAttr = '';
      const hostname = window.location.hostname;
      
      // Allow syncing across all bandcamp.com subdomains
      if (hostname.includes('bandcamp.com')) {
        domainAttr = ';domain=.bandcamp.com';
      }
      
      const cookieString = `${name}=${value};path=/;expires=${d.toUTCString()}${domainAttr}`;
      document.cookie = cookieString;
    } catch (e) {
      Logger.error('Error setting cookie:', e);
    }
  }

  /**
   * Update sidebar visibility based on current page type
   */
  private updateVisibilityForCurrentPage(): void {
    const container = document.querySelector('.bcks-sidebars-container') as HTMLElement;
    if (!container) {
      return;
    }

    // Hide sidebars on followers/following pages, show on others
    if (BandcampFacade.isFollowersPage || BandcampFacade.isFollowingPage) {
      container.style.display = 'none';
    } else {
      container.style.display = 'flex';
    }
  }

  /**
   * Create both settings and hotkeys sidebars
   */
  private createSidebars(): void {
    // Create settings sidebar (top)
    this.settingsSidebar = document.createElement('div');
    this.settingsSidebar.className = 'bcks-sidebar bcks-settings-sidebar';

    // Create hotkeys sidebar (middle)
    this.hotkeysSidebar = document.createElement('div');
    this.hotkeysSidebar.className = 'bcks-sidebar bcks-hotkeys-sidebar';

    // Create bulk purchase sidebar (bottom, hidden by default)
    this.bulkSidebar = document.createElement('div');
    this.bulkSidebar.className = 'bcks-sidebar bcks-bulk-sidebar';
    this.bulkSidebar.style.display = 'none';

    // Create a container for all sidebars
    this.sidebarsContainer = document.createElement('div');
    this.sidebarsContainer.className = 'bcks-sidebars-container';
    if (this.isSidebarsCollapsed) {
      this.sidebarsContainer.classList.add('collapsed');
    }
    this.sidebarsContainer.style.cssText = `
      position: fixed;
      top: 110px;
      right: 0;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0;
    `;

    // Create toggle tab
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'bcks-sidebar-toggle';
    toggleBtn.textContent = this.isSidebarsCollapsed ? '◀' : '▶';
    toggleBtn.title = 'Toggle Sidebar';
    
    toggleBtn.addEventListener('click', () => {
      this.toggleSidebarsCollapse(toggleBtn);
    });

    // Create wrapper for scrollable content
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'bcks-sidebar-scroll-container';

    this.sidebarsContainer.appendChild(toggleBtn);
    scrollContainer.appendChild(this.settingsSidebar);
    scrollContainer.appendChild(this.hotkeysSidebar);
    scrollContainer.appendChild(this.bulkSidebar);
    this.sidebarsContainer.appendChild(scrollContainer);
    
    document.body.appendChild(this.sidebarsContainer);
  }

  /**
   * Toggle the global sidebar collapse state
   */
  public static toggleCollapse(): void {
    if (this.instance) {
      this.instance.toggleSidebarsCollapse(null);
    }
  }

  /**
   * Toggle the global sidebar collapse state
   */
  private toggleSidebarsCollapse(btn: HTMLElement | null): void {
    if (!this.sidebarsContainer) return;
    
    this.isSidebarsCollapsed = !this.isSidebarsCollapsed;
    
    // Save state via cookie
    this.setCookie(KeyboardSidebarController.COOKIE_NAME, this.isSidebarsCollapsed.toString(), 365);
    
    this.updateCollapseStateUI();
  }

  /**
   * Update the UI to reflect current collapse state
   */
  private updateCollapseStateUI(): void {
    if (!this.sidebarsContainer) return;

    const toggleBtn = this.sidebarsContainer.querySelector('.bcks-sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = this.isSidebarsCollapsed ? '◀' : '▶';
    }
    
    if (this.isSidebarsCollapsed) {
      this.sidebarsContainer.classList.add('collapsed');
    } else {
      this.sidebarsContainer.classList.remove('collapsed');
    }
  }

  /**
   * Get available toggle settings for current page
   */

  /**
   * Get available keyboard shortcuts for current page (excluding bulk shortcuts)
   */

  /**
   * Get bulk purchase mode shortcuts
   */

  /**
   * Create a toggle button for a setting (using hotkey sidebar style)
   */

  /**
   * Create a hotkey button
   */

  /**
   * Create a simple title
   */

  /**
   * Render both sidebars
   */
  private render(): void {
    // Hide all sidebars on followers/following pages
    if (BandcampFacade.isFollowersPage || BandcampFacade.isFollowingPage) {
      if (this.settingsSidebar) this.settingsSidebar.style.display = 'none';
      if (this.hotkeysSidebar) this.hotkeysSidebar.style.display = 'none';
      if (this.bulkSidebar) this.bulkSidebar.style.display = 'none';
      return;
    }
    
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

    const settings = SidebarContent.getToggleSettings(this.controllers, () => this.render());
    if (settings.length === 0) {
      this.settingsSidebar.style.display = 'none';
      return;
    }

    this.settingsSidebar.style.display = 'flex';
    
    // Add title
    this.settingsSidebar.appendChild(SidebarView.createTitle('Settings'));

    // Add settings
    settings.forEach(setting => {
      if (!setting.condition || setting.condition()) {
        this.settingsSidebar!.appendChild(SidebarView.createToggleButton(setting));
      }
    });
  }

  /**
   * Render the hotkeys sidebar
   */
  private renderHotkeysSidebar(): void {
    if (!this.hotkeysSidebar) return;

    this.hotkeysSidebar.innerHTML = '';

    const shortcuts = SidebarContent.getKeyboardShortcuts(this.controllers, () => this.render());
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
    
    // Add title
    this.hotkeysSidebar.appendChild(SidebarView.createTitle('Hotkeys'));

    // Add shortcuts
    visibleShortcuts.forEach(shortcut => {
      this.hotkeysSidebar!.appendChild(SidebarView.createHotkeyButton(shortcut));
    });
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

    const bulkShortcuts = SidebarContent.getBulkShortcuts(this.controllers, () => this.render());

    if (bulkShortcuts.length === 0) {
      this.bulkSidebar.style.display = 'none';
      return;
    }

    // Add title
    this.bulkSidebar.appendChild(SidebarView.createTitle('Bulk Purchase'));

    // Add bulk shortcuts
    bulkShortcuts.forEach(shortcut => {
      this.bulkSidebar!.appendChild(SidebarView.createHotkeyButton(shortcut));
    });
  }

  /**
   * Setup page navigation listener to re-render when user navigates between pages
   */
  private setupBulkModeListener(): void {
    let lastPageType = this.getCurrentPageType();
    let wasOnWishlistPage = BandcampFacade.isWishlistPage;
    
    // Poll only for page navigation changes since button clicks and keyboard shortcuts
    // now trigger immediate UI updates
    setInterval(() => {
      const currentPageType = this.getCurrentPageType();
      const isOnWishlistPage = BandcampFacade.isWishlistPage;
      
      // Check if user navigated away from wishlist page while in bulk mode
      if (wasOnWishlistPage && !isOnWishlistPage && BulkCartService.isInBulkMode) {
        Logger.debug('User navigated away from wishlist page while in bulk mode, exiting bulk mode');
        BulkCartService.exitBulkMode();
        // Refresh UI immediately after exiting bulk mode
        this.render();
      }
      
      if (currentPageType !== lastPageType) {
        lastPageType = currentPageType;
        this.render();
      }
      
      // Update the wishlist page state for next iteration
      wasOnWishlistPage = isOnWishlistPage;
    }, 250);
  }

  /**
   * Get a string representing the current page type for comparison
   */
  private getCurrentPageType(): string {
    const parts = [];
    if (BandcampFacade.isWishlistPage) parts.push('wishlist');
    if (BandcampFacade.isCollectionPage) parts.push('collection');
    if (BandcampFacade.isFollowersPage) parts.push('followers');
    if (BandcampFacade.isFollowingPage) parts.push('following');
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
    const container = document.querySelector('.bcks-sidebars-container') as HTMLElement;
    if (container) {
      container.style.display = this.isVisible ? 'flex' : 'none';
    }
  }

  /**
   * Destroy the sidebars
   */
  private destroy(): void {
    const container = document.querySelector('.bcks-sidebars-container');
    if (container && container.parentElement) {
      container.parentElement.removeChild(container);
    }
    this.settingsSidebar = null;
    this.hotkeysSidebar = null;
  }
}
