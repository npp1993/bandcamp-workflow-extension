import {Logger} from '../utils/logger';

/**
 * Service for handling shuffle functionality on wishlist and collection pages
 */
export class ShuffleService {
  private static _isShuffleEnabled = false;
  private static _shuffleButton: HTMLElement | null = null;
  private static _shuffleHistory: number[] = [];
  private static _maxHistorySize = 50; // Remember last 50 tracks to avoid immediate repeats
  
  // Play history stack for 'p' key functionality when shuffle is enabled
  private static _playHistory: number[] = [];
  private static _maxPlayHistorySize = 100; // Remember last 100 played tracks for 'p' navigation

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
      Logger.info('Shuffle mode enabled');
      // Clear history when enabling shuffle to allow fresh randomization
      this._shuffleHistory = [];
      // Clear play history when enabling shuffle
      this._playHistory = [];
    } else {
      Logger.info('Shuffle mode disabled');
      // Clear play history when disabling shuffle (sequential mode doesn't need history)
      this._playHistory = [];
    }
  }

  /**
   * Get the next track index when shuffle is enabled
   * @param currentIndex The current track index
   * @param totalTracks The total number of tracks available
   * @returns The next track index (shuffled)
   */
  public static getNextShuffledIndex(currentIndex: number, totalTracks: number): number {
    if (!this._isShuffleEnabled || totalTracks <= 1) {
      // Shuffle not enabled or not enough tracks - return regular next index
      return (currentIndex + 1) % totalTracks;
    }

    // Generate a list of available indices excluding current track and recent history
    const availableIndices: number[] = [];
    const recentHistoryCount = Math.min(this._maxHistorySize, Math.floor(totalTracks * 0.3)); // Use 30% of total tracks or max history size
    const recentHistory = this._shuffleHistory.slice(-recentHistoryCount);

    for (let i = 0; i < totalTracks; i++) {
      // Skip current track and recently played tracks (if we have enough options)
      if (i !== currentIndex && !recentHistory.includes(i)) {
        availableIndices.push(i);
      }
    }

    // If we've exhausted all options (shouldn't happen with reasonable history size), 
    // allow any track except the current one
    if (availableIndices.length === 0) {
      Logger.info('Shuffle: All tracks in recent history, expanding options');
      for (let i = 0; i < totalTracks; i++) {
        if (i !== currentIndex) {
          availableIndices.push(i);
        }
      }
    }

    // Pick a random index from available options
    const randomIndex = Math.floor(Math.random() * availableIndices.length);
    const nextIndex = availableIndices[randomIndex];

    // Add to history
    this._shuffleHistory.push(nextIndex);

    // Trim history if it gets too long
    if (this._shuffleHistory.length > this._maxHistorySize) {
      this._shuffleHistory = this._shuffleHistory.slice(-this._maxHistorySize);
    }

    Logger.info(`Shuffle: Selected track ${nextIndex + 1} of ${totalTracks} (avoiding ${recentHistoryCount} recent tracks)`);
    return nextIndex;
  }

  /**
   * Record a manually selected track in the shuffle history
   * @param index The track index that was manually selected
   */
  public static recordManualSelection(index: number): void {
    if (this._isShuffleEnabled) {
      this._shuffleHistory.push(index);
      
      // Trim history if it gets too long
      if (this._shuffleHistory.length > this._maxHistorySize) {
        this._shuffleHistory = this._shuffleHistory.slice(-this._maxHistorySize);
      }
      
      Logger.info(`Shuffle: Recorded manual selection of track ${index + 1}`);
    }
  }

  /**
   * Add a track to the play history (for 'p' key functionality in shuffle mode)
   * @param index The track index that was played
   */
  public static addToPlayHistory(index: number): void {
    // Only maintain play history when shuffle is enabled
    if (this._isShuffleEnabled) {
      this._playHistory.push(index);
      
      // Trim play history if it gets too long
      if (this._playHistory.length > this._maxPlayHistorySize) {
        this._playHistory = this._playHistory.slice(-this._maxPlayHistorySize);
      }
      
      Logger.info(`Shuffle: Added track ${index + 1} to play history (history size: ${this._playHistory.length})`);
    }
  }

  /**
   * Get the previous track index from play history when shuffle is enabled
   * @param currentIndex The current track index
   * @param totalTracks The total number of tracks available
   * @returns The previous track index from history, or null if no history available
   */
  public static getPreviousFromHistory(currentIndex: number, totalTracks: number): number | null {
    if (!this._isShuffleEnabled || this._playHistory.length === 0) {
      // No shuffle or no history
      Logger.info(`Shuffle: No previous history available (enabled=${this._isShuffleEnabled}, history length=${this._playHistory.length})`);
      return null;
    }

    // If we only have 1 track in history and we're on a different track, go back to it
    if (this._playHistory.length === 1) {
      const lastPlayedTrack = this._playHistory[0];
      if (lastPlayedTrack !== currentIndex) {
        Logger.info(`Shuffle: Going back to the only track in history (track ${lastPlayedTrack + 1})`);
        return lastPlayedTrack;
      } else {
        Logger.info(`Shuffle: Current track is the only track in history, no previous available`);
        return null;
      }
    }

    // Multiple tracks in history - find the previous one
    const historyWithoutCurrent = [...this._playHistory];
    if (historyWithoutCurrent[historyWithoutCurrent.length - 1] === currentIndex) {
      historyWithoutCurrent.pop();
    }

    if (historyWithoutCurrent.length === 0) {
      Logger.info(`Shuffle: No previous tracks in history after removing current`);
      return null;
    }

    // Get the previous track from history
    const previousIndex = historyWithoutCurrent[historyWithoutCurrent.length - 1];
    
    // Remove the previous track from our internal history since we're going back to it
    this._playHistory.pop(); // Remove current
    if (this._playHistory.length > 0) {
      this._playHistory.pop(); // Remove the track we're going back to
    }
    
    Logger.info(`Shuffle: Going back to track ${previousIndex + 1} from play history`);
    return previousIndex;
  }

  /**
   * Check if we have previous tracks in play history
   * @param currentIndex The current track index (optional, for more accurate checking)
   * @returns True if there are previous tracks available in shuffle history
   */
  public static hasPreviousInHistory(currentIndex?: number): boolean {
    if (!this._isShuffleEnabled || this._playHistory.length === 0) {
      return false;
    }

    // If we have multiple tracks in history, we definitely have previous tracks
    if (this._playHistory.length > 1) {
      return true;
    }

    // If we only have 1 track and we know the current index, check if it's different
    if (this._playHistory.length === 1 && currentIndex !== undefined) {
      return this._playHistory[0] !== currentIndex;
    }

    // If we only have 1 track but don't know current index, assume there might be previous
    return this._playHistory.length >= 1;
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
   * Reset shuffle service (called when navigating between pages)
   */
  public static reset(): void {
    this._shuffleHistory = [];
    this._playHistory = [];
    // Note: We don't reset _isShuffleEnabled to maintain user preference across page navigation
    Logger.info('Shuffle service reset');
  }
}
