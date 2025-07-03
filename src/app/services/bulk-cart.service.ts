import {Logger} from '../utils/logger';
import {AddToCartUtils} from '../utils/add-to-cart-utils';

/**
 * Service for handling bulk cart operations on wishlist items
 */
export class BulkCartService {
  private static _isInBulkMode = false;
  private static _selectedItems: Set<HTMLElement> = new Set();
  private static _focusedItemIndex = 0;
  private static _wishlistItems: HTMLElement[] = [];
  private static _isProcessing = false;
  private static _bulkButton: HTMLElement | null = null;
  private static _isFKeyHeld = false;
  private static _selectAllButton: HTMLElement | null = null;
  private static _deselectAllButton: HTMLElement | null = null;

  /**
   * Check if currently in bulk selection mode
   */
  public static get isInBulkMode(): boolean {
    return this._isInBulkMode;
  }

  /**
   * Check if currently processing cart additions
   */
  public static get isProcessing(): boolean {
    return this._isProcessing;
  }

  /**
   * Enter bulk selection mode
   */
  public static enterBulkMode(wishlistItems: HTMLElement[]): void {
    if (this._isInBulkMode) {
      return;
    }

    Logger.info('Entering bulk selection mode');
    this._isInBulkMode = true;
    this._wishlistItems = [...wishlistItems];
    this._focusedItemIndex = 0;

    // Select all items by default
    this._selectedItems.clear();
    this._wishlistItems.forEach((item) => {
      this._selectedItems.add(item);
    });

    this.updateVisualState();
    this.updateButtonText();
    this.showBulkModeButtons();
    this.focusItem(0);
    
    Logger.info(`Bulk mode entered with ${this._selectedItems.size} items selected`);
  }

  /**
   * Exit bulk selection mode
   */
  public static exitBulkMode(): void {
    if (!this._isInBulkMode) {
      return;
    }

    Logger.info('Exiting bulk selection mode');
    this._isInBulkMode = false;
    this._isProcessing = false;
    this._selectedItems.clear();
    this._focusedItemIndex = 0;
    this._isFKeyHeld = false;

    this.clearVisualState();
    this.updateButtonText();
    this.hideBulkModeButtons();
    this.hideBulkModeButtons();
    
    Logger.info('Bulk mode exited');
  }

  /**
   * Toggle selection of currently focused item
   */
  public static toggleCurrentSelection(): void {
    if (!this._isInBulkMode || this._wishlistItems.length === 0) {
      return;
    }

    const currentItem = this._wishlistItems[this._focusedItemIndex];
    if (!currentItem) {
      return;
    }

    if (this._selectedItems.has(currentItem)) {
      this._selectedItems.delete(currentItem);
      Logger.info('Item deselected');
    } else {
      this._selectedItems.add(currentItem);
      Logger.info('Item selected');
    }

    this.updateItemVisualState(currentItem);
    this.updateButtonText();
  }

  /**
   * Navigate to next item
   */
  public static navigateNext(): void {
    if (!this._isInBulkMode || this._wishlistItems.length === 0) {
      return;
    }

    // Wrap around to first item if we're at the last item
    const nextIndex = (this._focusedItemIndex + 1) % this._wishlistItems.length;
    this.focusItem(nextIndex);
  }

  /**
   * Navigate to previous item
   */
  public static navigatePrevious(): void {
    if (!this._isInBulkMode || this._wishlistItems.length === 0) {
      return;
    }

    // Wrap around to last item if we're at the first item
    const prevIndex = this._focusedItemIndex === 0 
      ? this._wishlistItems.length - 1 
      : this._focusedItemIndex - 1;
    this.focusItem(prevIndex);
  }

  /**
   * Process selected items and add them to cart
   */
  public static async processSelectedItems(): Promise<void> {
    if (!this._isInBulkMode || this._selectedItems.size === 0 || this._isProcessing) {
      return;
    }

    Logger.info(`Starting bulk cart processing for ${this._selectedItems.size} items`);
    this._isProcessing = true;

    const selectedArray = Array.from(this._selectedItems);
    
    for (let i = 0; i < selectedArray.length; i++) {
      // Check if user exited bulk mode during processing
      if (!this._isInBulkMode) {
        Logger.info('Bulk mode exited during processing, stopping');
        break;
      }

      const item = selectedArray[i];
      try {
        await this.addItemToCart(item);
      } catch (error) {
        Logger.error('Failed to add item to cart:', error);
        // Continue with next item (no retry as requested)
      }

      // Small delay between items to avoid overwhelming the browser
      if (i < selectedArray.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Exit bulk mode after processing
    this.exitBulkMode();
    Logger.info('Bulk cart processing completed');
  }

  /**
   * Set the bulk button reference for text updates
   */
  public static setBulkButton(button: HTMLElement): void {
    this._bulkButton = button;
  }

  /**
   * Set the select all button reference
   */
  public static setSelectAllButton(button: HTMLElement): void {
    this._selectAllButton = button;
  }

  /**
   * Set the deselect all button reference
   */
  public static setDeselectAllButton(button: HTMLElement): void {
    this._deselectAllButton = button;
  }

  /**
   * Set F key held state
   */
  public static setFKeyHeld(isHeld: boolean): void {
    this._isFKeyHeld = isHeld;
  }

  /**
   * Check if F key is currently held
   */
  public static get isFKeyHeld(): boolean {
    return this._isFKeyHeld;
  }

  /**
   * Select all items
   */
  public static selectAllItems(): void {
    if (!this._isInBulkMode || this._wishlistItems.length === 0) {
      return;
    }

    this._selectedItems.clear();
    this._wishlistItems.forEach((item) => {
      this._selectedItems.add(item);
    });

    this.updateVisualState();
    this.updateButtonText();
    Logger.info(`Selected all ${this._selectedItems.size} items`);
  }

  /**
   * Deselect all items
   */
  public static deselectAllItems(): void {
    if (!this._isInBulkMode || this._wishlistItems.length === 0) {
      return;
    }

    this._selectedItems.clear();
    this.updateVisualState();
    this.updateButtonText();
    Logger.info('Deselected all items');
  }

  /**
   * Show bulk mode buttons (select all, deselect all)
   */
  private static showBulkModeButtons(): void {
    if (this._selectAllButton) {
      this._selectAllButton.style.display = 'inline-block';
    }
    if (this._deselectAllButton) {
      this._deselectAllButton.style.display = 'inline-block';
    }
  }

  /**
   * Hide bulk mode buttons (select all, deselect all)
   */
  private static hideBulkModeButtons(): void {
    if (this._selectAllButton) {
      this._selectAllButton.style.display = 'none';
    }
    if (this._deselectAllButton) {
      this._deselectAllButton.style.display = 'none';
    }
  }

  /**
   * Focus on a specific item by index
   */
  private static focusItem(index: number): void {
    if (index < 0 || index >= this._wishlistItems.length) {
      return;
    }

    // Remove focus from previous item
    if (this._focusedItemIndex >= 0 && this._focusedItemIndex < this._wishlistItems.length) {
      const prevItem = this._wishlistItems[this._focusedItemIndex];
      this.removeFocusVisualState(prevItem);
    }

    this._focusedItemIndex = index;
    const currentItem = this._wishlistItems[index];
    
    // Add focus to new item
    this.addFocusVisualState(currentItem);
    
    // If F key is held, automatically toggle selection of the newly focused item
    if (this._isFKeyHeld) {
      this.toggleCurrentSelection();
    }
    
    // Ensure item is visible, accounting for sticky header
    this.ensureItemVisible(currentItem);
  }

  /**
   * Ensure item is visible on screen, accounting for sticky header and footer
   */
  private static ensureItemVisible(item: HTMLElement): void {
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
      window.scrollBy({
        top: scrollOffset,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Get the height of the sticky header
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
    
    // Check for the wishlist page sticky header
    const wishlistHeader = document.querySelector('#grid-tabs-sticky.fixed') as HTMLElement;
    if (wishlistHeader) {
      const headerRect = wishlistHeader.getBoundingClientRect();
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
    // Check for our custom fixed footer first (only if it's visible)
    const customFooter = document.querySelector('.bandcamp-plus-controls-footer') as HTMLElement;
    if (customFooter && customFooter.style.display !== 'none') {
      const rect = customFooter.getBoundingClientRect();
      if (rect.height > 0) {
        Logger.info(`Footer detected: custom footer, height: ${rect.height}`);
        return rect.height;
      }
    }
    
    // Check for the main carousel player (when music is playing)
    const carouselPlayer = document.querySelector('.carousel-player') as HTMLElement;
    if (carouselPlayer) {
      const rect = carouselPlayer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (rect.bottom >= viewportHeight - 20 && rect.height > 0) {
        Logger.info(`Footer detected: carousel-player, height: ${rect.height}`);
        return rect.height;
      }
    }
    
    // Check for the carousel player inner container
    const carouselPlayerInner = document.querySelector('.carousel-player-inner') as HTMLElement;
    if (carouselPlayerInner) {
      const rect = carouselPlayerInner.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (rect.bottom >= viewportHeight - 20 && rect.height > 0) {
        Logger.info(`Footer detected: carousel-player-inner, height: ${rect.height}`);
        return rect.height;
      }
    }
    
    // Check for the Bandcamp player at the bottom of the page
    const player = document.querySelector('#player') as HTMLElement;
    if (player) {
      const playerRect = player.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (playerRect.bottom >= viewportHeight - 20 && playerRect.height > 0) {
        Logger.info(`Footer detected: #player, height: ${playerRect.height}`);
        return playerRect.height;
      }
    }
    
    // Check for any sticky footer elements
    const footerElements = [
      '.footer.fixed',
      '.footer.sticky',
      '.bottom-bar',
      '.music-player.fixed',
      '.playbar.fixed'
    ];
    
    for (const selector of footerElements) {
      const footer = document.querySelector(selector) as HTMLElement;
      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        if (footerRect.bottom >= viewportHeight - 20 && footerRect.height > 0) {
          Logger.info(`Footer detected: ${selector}, height: ${footerRect.height}`);
          return footerRect.height;
        }
      }
    }
    
    Logger.info('No footer detected');
    return 0;
  }

  /**
   * Add item to cart using the shared AddToCartUtils method
   * This ensures consistency with the 'c' key functionality
   */
  private static async addItemToCart(item: HTMLElement): Promise<void> {
    return AddToCartUtils.addWishlistItemToCart(item, {
      checkNowPlaying: false,
      logPrefix: 'Adding item to cart via bulk mode',
      closeTabAfterAdd: true
    });
  }

  /**
   * Update visual state for all items
   */
  private static updateVisualState(): void {
    this._wishlistItems.forEach((item) => {
      this.updateItemVisualState(item);
    });
  }

  /**
   * Update visual state for a specific item
   */
  private static updateItemVisualState(item: HTMLElement): void {
    const isSelected = this._selectedItems.has(item);
    
    if (isSelected) {
      item.style.backgroundColor = 'rgba(29, 160, 195, 0.3)';
      item.setAttribute('data-bcwf-bulk-selected', 'true');
    } else {
      item.style.backgroundColor = '';
      item.removeAttribute('data-bcwf-bulk-selected');
    }
  }

  /**
   * Add focus visual state to item
   */
  private static addFocusVisualState(item: HTMLElement): void {
    item.style.border = '2px solid #1da0c3';
    item.style.borderRadius = '4px';
    item.setAttribute('data-bcwf-bulk-focused', 'true');
  }

  /**
   * Remove focus visual state from item
   */
  private static removeFocusVisualState(item: HTMLElement): void {
    item.style.border = '';
    item.style.borderRadius = '';
    item.removeAttribute('data-bcwf-bulk-focused');
  }

  /**
   * Clear all visual states
   */
  private static clearVisualState(): void {
    this._wishlistItems.forEach((item) => {
      item.style.backgroundColor = '';
      item.style.border = '';
      item.style.borderRadius = '';
      item.removeAttribute('data-bcwf-bulk-selected');
      item.removeAttribute('data-bcwf-bulk-focused');
    });
  }

  /**
   * Update button text based on current state
   */
  private static updateButtonText(): void {
    if (!this._bulkButton) {
      return;
    }

    if (this._isInBulkMode) {
      const selectedCount = this._selectedItems.size;
      this._bulkButton.textContent = `Add Selected to Cart (${selectedCount} items)`;
    } else {
      this._bulkButton.textContent = 'Bulk Add to Cart';
    }
  }
}
