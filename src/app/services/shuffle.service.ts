import {Logger} from '../utils/logger';

/**
 * Service for handling shuffle functionality on wishlist and collection pages
 */
export class ShuffleService {
  private static _isShuffleEnabled = false;
  private static _shuffleButton: HTMLElement | null = null;
  
  // Separate shuffled orders for different page types
  private static _wishlistShuffledOrder: number[] = [];
  private static _collectionShuffledOrder: number[] = [];
  
  // Current positions in the shuffled orders
  private static _wishlistShufflePosition = 0;
  private static _collectionShufflePosition = 0;
  
  // Page type tracking
  private static _currentPageType: 'wishlist' | 'collection' | null = null;

  /**
   * Check if shuffle mode is currently enabled
   */
  public static get isShuffleEnabled(): boolean {
    return this._isShuffleEnabled;
  }

  /**
   * Toggle shuffle mode on/off
   */
  public static toggleShuffle(): void {
    this._isShuffleEnabled = !this._isShuffleEnabled;
    this.updateButtonState();
    
    if (this._isShuffleEnabled) {
      // Clear existing shuffle orders to force re-randomization
      this._wishlistShuffledOrder = [];
      this._collectionShuffledOrder = [];
      this._wishlistShufflePosition = 0;
      this._collectionShufflePosition = 0;
    } else {
      // Clear shuffle orders when disabling
      this._wishlistShuffledOrder = [];
      this._collectionShuffledOrder = [];
      this._wishlistShufflePosition = 0;
      this._collectionShufflePosition = 0;
    }
  }

  /**
   * Initialize shuffle order for a specific page type
   * @param pageType The type of page ('wishlist' or 'collection')
   * @param totalTracks Total number of tracks available
   * @param currentIndex Current track index (will be first in shuffled order)
   */
  public static initializeShuffleOrder(pageType: 'wishlist' | 'collection', totalTracks: number, currentIndex: number): void {
    this._currentPageType = pageType;
    
    if (totalTracks <= 1) {
      return;
    }
    
    // Create array of all indices
    const allIndices = Array.from({ length: totalTracks }, (_, i) => i);
    
    // Remove current track from the array
    const otherIndices = allIndices.filter(i => i !== currentIndex);
    
    // Shuffle the other indices using Fisher-Yates algorithm
    for (let i = otherIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherIndices[i], otherIndices[j]] = [otherIndices[j], otherIndices[i]];
    }
    
    // Create shuffled order with current track first
    const shuffledOrder = [currentIndex, ...otherIndices];
    
    // Store in appropriate array
    if (pageType === 'wishlist') {
      this._wishlistShuffledOrder = shuffledOrder;
      this._wishlistShufflePosition = 0; // Current track is at position 0
    } else {
      this._collectionShuffledOrder = shuffledOrder;
      this._collectionShufflePosition = 0; // Current track is at position 0
    }
  }

  /**
   * Get the next track index in shuffle order
   * @param pageType The type of page ('wishlist' or 'collection')
   * @param totalTracks Total number of tracks available
   * @param currentIndex Current track index
   * @returns The next track index in shuffle order
   */
  public static getNextShuffledIndex(pageType: 'wishlist' | 'collection', totalTracks: number, currentIndex: number): number {
    if (!this._isShuffleEnabled || totalTracks <= 1) {
      return (currentIndex + 1) % totalTracks;
    }
    
    // Get the appropriate shuffled order and position
    const shuffledOrder = pageType === 'wishlist' ? this._wishlistShuffledOrder : this._collectionShuffledOrder;
    let currentPosition = pageType === 'wishlist' ? this._wishlistShufflePosition : this._collectionShufflePosition;
    
    // If we don't have a shuffled order or it's outdated, initialize it
    if (shuffledOrder.length !== totalTracks || !shuffledOrder.includes(currentIndex)) {
      this.initializeShuffleOrder(pageType, totalTracks, currentIndex);
      return currentIndex; // Stay on current track after initialization
    }
    
    // Find current position in shuffled order
    const actualPosition = shuffledOrder.indexOf(currentIndex);
    if (actualPosition !== -1) {
      currentPosition = actualPosition;
    }
    
    // Move to next position
    const nextPosition = (currentPosition + 1) % shuffledOrder.length;
    const nextIndex = shuffledOrder[nextPosition];
    
    // Update position
    if (pageType === 'wishlist') {
      this._wishlistShufflePosition = nextPosition;
    } else {
      this._collectionShufflePosition = nextPosition;
    }
    
    return nextIndex;
  }

  /**
   * Get the previous track index in shuffle order
   * @param pageType The type of page ('wishlist' or 'collection')
   * @param totalTracks Total number of tracks available
   * @param currentIndex Current track index
   * @returns The previous track index in shuffle order
   */
  public static getPreviousShuffledIndex(pageType: 'wishlist' | 'collection', totalTracks: number, currentIndex: number): number {
    if (!this._isShuffleEnabled || totalTracks <= 1) {
      return currentIndex - 1 < 0 ? totalTracks - 1 : currentIndex - 1;
    }
    
    // Get the appropriate shuffled order and position
    const shuffledOrder = pageType === 'wishlist' ? this._wishlistShuffledOrder : this._collectionShuffledOrder;
    let currentPosition = pageType === 'wishlist' ? this._wishlistShufflePosition : this._collectionShufflePosition;
    
    // If we don't have a shuffled order or it's outdated, initialize it
    if (shuffledOrder.length !== totalTracks || !shuffledOrder.includes(currentIndex)) {
      this.initializeShuffleOrder(pageType, totalTracks, currentIndex);
      return currentIndex; // Stay on current track after initialization
    }
    
    // Find current position in shuffled order
    const actualPosition = shuffledOrder.indexOf(currentIndex);
    if (actualPosition !== -1) {
      currentPosition = actualPosition;
    }
    
    // Move to previous position
    const prevPosition = currentPosition - 1 < 0 ? shuffledOrder.length - 1 : currentPosition - 1;
    const prevIndex = shuffledOrder[prevPosition];
    
    // Update position
    if (pageType === 'wishlist') {
      this._wishlistShufflePosition = prevPosition;
    } else {
      this._collectionShufflePosition = prevPosition;
    }
    
    return prevIndex;
  }

  /**
   * Update the current position in shuffle order when a track is manually selected
   * @param pageType The type of page ('wishlist' or 'collection')
   * @param totalTracks Total number of tracks available
   * @param currentIndex The manually selected track index
   */
  public static updateShufflePosition(pageType: 'wishlist' | 'collection', totalTracks: number, currentIndex: number): void {
    if (!this._isShuffleEnabled) {
      return;
    }
    
    // Get the appropriate shuffled order
    const shuffledOrder = pageType === 'wishlist' ? this._wishlistShuffledOrder : this._collectionShuffledOrder;
    
    // If we don't have a shuffled order or it's outdated, initialize it
    if (shuffledOrder.length !== totalTracks || !shuffledOrder.includes(currentIndex)) {
      this.initializeShuffleOrder(pageType, totalTracks, currentIndex);
      return;
    }
    
    // Find and update position
    const position = shuffledOrder.indexOf(currentIndex);
    if (position !== -1) {
      if (pageType === 'wishlist') {
        this._wishlistShufflePosition = position;
      } else {
        this._collectionShufflePosition = position;
      }
    } else {
      Logger.warn(`Current index ${currentIndex} not found in shuffle order`);
    }
  }

  /**
   * Set the shuffle button reference
   */
  public static setShuffleButton(button: HTMLElement): void {
    this._shuffleButton = button;
    this.updateButtonState();
  }

  /**
   * Update the visual state of the shuffle button
   */
  private static updateButtonState(): void {
    if (!this._shuffleButton) {
      return;
    }

    if (this._isShuffleEnabled) {
      this._shuffleButton.style.backgroundColor = '#28a745'; // Green when enabled
      this._shuffleButton.textContent = 'Shuffle: ON (S)';
      this._shuffleButton.title = 'Shuffle mode is enabled - Press S to disable';
    } else {
      this._shuffleButton.style.backgroundColor = '#6c757d'; // Gray when disabled
      this._shuffleButton.textContent = 'Shuffle: OFF (S)';
      this._shuffleButton.title = 'Shuffle mode is disabled - Press S to enable';
    }
  }

  /**
   * Update shuffle order when new items are loaded (e.g., manually loading more collection items)
   * This integrates new items into the existing shuffle order if shuffle mode is enabled
   * @param pageType The type of page ('wishlist' or 'collection')
   * @param newTotalTracks The new total number of tracks after loading
   * @param currentIndex The current track index
   */
  public static updateShuffleOrderForNewItems(pageType: 'wishlist' | 'collection', newTotalTracks: number, currentIndex: number): void {
    if (!this._isShuffleEnabled) {
      return;
    }

    // Get the appropriate shuffled order
    const shuffledOrder = pageType === 'wishlist' ? this._wishlistShuffledOrder : this._collectionShuffledOrder;
    
    // If we don't have an existing shuffle order, initialize it
    if (shuffledOrder.length === 0) {
      this.initializeShuffleOrder(pageType, newTotalTracks, currentIndex);
      return;
    }

    // If the total tracks hasn't changed, no new items were loaded
    if (shuffledOrder.length === newTotalTracks) {
      return;
    }

    // Calculate how many new items were added
    const oldTotal = shuffledOrder.length;
    const newItemsCount = newTotalTracks - oldTotal;
    
    if (newItemsCount <= 0) {
      return; // No new items or items were removed
    }

    // Create array of new item indices
    const newIndices = Array.from({ length: newItemsCount }, (_, i) => oldTotal + i);
    
    // Shuffle the new indices using Fisher-Yates algorithm
    for (let i = newIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newIndices[i], newIndices[j]] = [newIndices[j], newIndices[i]];
    }

    // Insert new items randomly into the existing shuffle order
    // We'll preserve the current position and insert items after it
    const currentPosition = pageType === 'wishlist' ? this._wishlistShufflePosition : this._collectionShufflePosition;
    
    // Split the existing order at random positions and insert new items
    const updatedOrder = [...shuffledOrder];
    
    newIndices.forEach(newIndex => {
      // Insert at a random position after the current position to avoid disrupting the next few tracks
      const insertPosition = Math.floor(Math.random() * (updatedOrder.length - currentPosition - 1)) + currentPosition + 1;
      updatedOrder.splice(insertPosition, 0, newIndex);
    });

    // Update the appropriate shuffle order
    if (pageType === 'wishlist') {
      this._wishlistShuffledOrder = updatedOrder;
    } else {
      this._collectionShuffledOrder = updatedOrder;
    }

    Logger.info(`Updated ${pageType} shuffle order: integrated ${newItemsCount} new items into existing shuffle (total: ${newTotalTracks} items)`);
  }

  /**
   * Reset shuffle service (called when navigating between pages)
   */
  public static reset(): void {
    this._wishlistShuffledOrder = [];
    this._collectionShuffledOrder = [];
    this._wishlistShufflePosition = 0;
    this._collectionShufflePosition = 0;
    this._currentPageType = null;
    // Note: We don't reset _isShuffleEnabled to maintain user preference across page navigation
  }

  /**
   * Get debug information about current shuffle state
   */
  public static getDebugInfo(): any {
    return {
      isShuffleEnabled: this._isShuffleEnabled,
      currentPageType: this._currentPageType,
      wishlistOrder: this._wishlistShuffledOrder,
      wishlistPosition: this._wishlistShufflePosition,
      collectionOrder: this._collectionShuffledOrder,
      collectionPosition: this._collectionShufflePosition
    };
  }
}
