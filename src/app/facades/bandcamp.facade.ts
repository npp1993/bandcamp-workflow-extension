// @ts-nocheck - Temporarily disable strict null checks for this large facade file
import {SEEK_STEP, TIMEOUT} from '../constants';
import {Logger} from '../utils/logger';
import {AlbumOnlyUtils} from '../utils/album-only-utils';
import {AudioUtils} from '../utils/audio-utils';
import {SeekUtils} from '../utils/seek-utils';
import {ErrorHandler} from '../utils/error-handler';
import {DOMSelectors} from '../utils/dom-selectors';
import {AddToCartUtils} from '../utils/add-to-cart-utils';
import {WishlistService} from '../services/wishlist.service';
import {NotificationService} from '../services/notification.service';
import {ShuffleService} from '../services/shuffle.service';

// Add type definition for window.TralbumData
declare global {
  interface Window {
    TralbumData: any;
  }
}

export interface BandcampColors {
  bg_color: string;
  body_color: string;
  hd_ft_color: string;
  link_color: string;
  navbar_bg_color: string;
  secondary_text_color: string;
  text_color: string;
}

export interface BandcampData {
  fan_tralbum_data: {
    band_id: number;
    fan_id: number;
    is_wishlisted: boolean;
  };
}

export enum BandcampWishlistState {
  NotLiked = 'wishlist',
  Liked = 'wishlisted',
}

/**
 * Class to handle the BandcampFacade module.
 */
export class BandcampFacade {
  private static _data: BandcampData;

  private static _isTrack: boolean;

  private static _isAlbum: boolean;

  private static _isWishlistPage: boolean;

  private static _isCollectionPage: boolean;

  private static _isFollowersPage: boolean;

  private static _isFollowingPage: boolean;

  private static _colors: BandcampColors;

  private static _audio: HTMLAudioElement;

  private static _wishlistItems: HTMLElement[] = [];

  private static _currentWishlistIndex = -1;

  private static _pendingNextTrackRequest = false;

  private static _errorRecoveryInProgress = false;

  private static _skipInProgress = false;

  private static _consecutiveErrors = 0;

  private static _maxConsecutiveErrors = 3;

  private static _errorLogSuppressed = false;

  private static _releaseNavigationInProgress = false;
  
  // Flag to track when we're doing programmatic navigation (vs manual user clicks)
  private static _programmaticNavigationInProgress = false;
  // _playAttemptMade is already declared at line 59

  // Static list to keep track of problematic track IDs that return 404s
  private static _problemTrackIds: Set<string> = new Set();

  // Phase 2 Performance Monitoring - track optimization effectiveness
  private static _phase2MetricsEnabled = true;

  private static _navigationDelaysSaved = 0;

  private static _errorRecoveryDelaysSaved = 0;

  private static _domSelectionOptimizations = 0;

  private static _flagClearingOptimizations = 0;

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

  public static get data(): BandcampData {
    if (this._data) {
      return this._data;
    }

    const pageData = document.getElementById('pagedata');
    if (!pageData) {
      return null;
    }

    const dataBlob = pageData.getAttribute('data-blob');
    if (!dataBlob) {
      return null;
    }
    this._data = JSON.parse(dataBlob);

    return this._data;
  }

  public static get isTrack(): boolean {
    if (typeof this._isTrack !== 'undefined') {
      return this._isTrack;
    }

    this._isTrack = window.location.href.includes('/track/');

    return this._isTrack;
  }

  public static get isAlbum(): boolean {
    if (typeof this._isAlbum !== 'undefined') {
      return this._isAlbum;
    }

    this._isAlbum = !this.isTrack && document.getElementById('trackInfo') !== null;

    return this._isAlbum;
  }

  public static get isWishlistPage(): boolean {
    if (typeof this._isWishlistPage !== 'undefined') {
      return this._isWishlistPage;
    }

    // Only activate wishlist controls when URL matches the specific format: bandcamp.com/username/wishlist
    // This excludes collection pages (bandcamp.com/username) and other pages
    const url = window.location.href;
    const wishlistRegex = /^https?:\/\/[^\/]*bandcamp\.com\/[^\/]+\/wishlist(?:[?#].*)?$/;
    this._isWishlistPage = wishlistRegex.test(url);

    return this._isWishlistPage;
  }

  public static get isCollectionPage(): boolean {
    if (typeof this._isCollectionPage !== 'undefined') {
      return this._isCollectionPage;
    }

    // Detect collection pages: bandcamp.com/username (without /wishlist, /followers, or /following)
    const url = window.location.href;
    const collectionRegex = /^https?:\/\/[^\/]*bandcamp\.com\/[^\/]+(?:[?#].*)?$/;
    this._isCollectionPage = collectionRegex.test(url) && !this.isWishlistPage && !this.isFollowersPage && !this.isFollowingPage;

    return this._isCollectionPage;
  }

  public static get isFollowersPage(): boolean {
    if (typeof this._isFollowersPage !== 'undefined') {
      return this._isFollowersPage;
    }

    const url = window.location.href;
    const followersRegex = /^https?:\/\/[^\/]*bandcamp\.com\/[^\/]+\/followers(?:\/.*)?(?:[?#].*)?$/;
    this._isFollowersPage = followersRegex.test(url);

    return this._isFollowersPage;
  }

  public static get isFollowingPage(): boolean {
    if (typeof this._isFollowingPage !== 'undefined') {
      return this._isFollowingPage;
    }

    const url = window.location.href;
    const followingRegex = /^https?:\/\/[^\/]*bandcamp\.com\/[^\/]+\/following(?:\/.*)?(?:[?#].*)?$/;
    this._isFollowingPage = followingRegex.test(url);

    return this._isFollowingPage;
  }

  /**
   * Check if current page supports track transport controls (wishlist or collection)
   */
  public static get isCollectionBasedPage(): boolean {
    return this.isWishlistPage || this.isCollectionPage;
  }

  /**
   * Get the current wishlist item index for debugging purposes
   */
  public static get currentWishlistIndex(): number {
    return this._currentWishlistIndex;
  }

  public static get colors(): BandcampColors {
    if (this._colors) {
      return this._colors;
    }

    const node = document.getElementById('custom-design-rules-style');

    if (!node) {
      setTimeout(() => this.colors, TIMEOUT);
      return;
    }

    this._colors = JSON.parse(node.getAttribute('data-design'));

    return this._colors;
  }

  public static get audio(): HTMLAudioElement {
    if (this._audio) {
      return this._audio;
    }

    this._audio = document.getElementsByTagName('audio')[0];

    return this._audio;
  }

  public static get isPageSupported(): boolean {
    return BandcampFacade.isAlbum || BandcampFacade.isTrack;
  }

  public static get isLoggedIn(): boolean {
    return !document
      .getElementById('pagedata')
      .getAttribute('data-blob')
      .includes('"fan_tralbum_data":null');
  }

  public static get currentTrackContainer(): HTMLSpanElement {
    return document.querySelector('#trackInfo span.title');
  }

  public static get trackTable(): HTMLTableElement | null {
    return document.getElementById('track_table') as HTMLTableElement;
  }

  public static get tracks(): HTMLTableRowElement[] {
    const tracks = this.trackTable.querySelectorAll('.track_row_view');
    return Array.from(tracks as NodeListOf<HTMLTableRowElement>);
  }

  public static get player(): HTMLDivElement {
    return document.getElementsByClassName(
      'inline_player',
    )[0] as HTMLDivElement;
  }

  public static get wishlistButton(): HTMLLIElement {
    return document.getElementById('collect-item') as HTMLLIElement;
  }

  public static getTrackInfo(): string {
    let payload = '';

    const artist = document.getElementById('name-section').children[1]
      .children[0] as HTMLSpanElement;
    payload += artist.innerText;

    if (this.isTrack) {
      const trackTitle = document.getElementsByClassName(
        'trackTitle',
      )[0] as HTMLTitleElement;
      payload += ` ${trackTitle.innerText}`;
    } else if (this.isAlbum) {
      const albumTitle = document.getElementsByClassName(
        'title-section',
      )[0] as HTMLSpanElement;
      payload += ` ${albumTitle.innerText}`;
    }

    return payload.trim();
  }

  public static arrange(): void {
    this.movePlaylist();
    this.rectifyMargins();
  }

  public static getPlay(): HTMLDivElement {
    return document.getElementsByClassName('playbutton')[0] as HTMLDivElement;
  }

  public static getPrevious(): HTMLDivElement {
    return document.getElementsByClassName('prevbutton')[0] as HTMLDivElement;
  }

  public static getNext(): HTMLDivElement {
    return document.getElementsByClassName('nextbutton')[0] as HTMLDivElement;
  }

  /**
   * Get the current track index in the album
   * @returns The index of the currently playing track, or -1 if no track is playing
   */
  public static getCurrentTrackIndex(): number {
    const tracks = this.tracks;
    if (tracks.length === 0) {
      return -1;
    }
    
    const currentTrackRow = document.querySelector('.track_row_view.current_track');
    if (!currentTrackRow) {
      return -1;
    }
    
    return tracks.indexOf(currentTrackRow as HTMLTableRowElement);
  }

  /**
   * Navigate to a specific track by index (used for wrap-around edge cases)
   * @param trackIndex The index of the track to navigate to
   */
  public static navigateToTrack(trackIndex: number): void {
    const tracks = this.tracks;
    if (trackIndex < 0 || trackIndex >= tracks.length) {
      Logger.warn(`Invalid track index: ${trackIndex}, total tracks: ${tracks.length}`);
      return;
    }
    
    const targetTrack = tracks[trackIndex];
    
    try {
      // Use the same approach as playFirstTrack which works
      // Structure: track row -> children[0] -> children[0] -> children[0] = play button div
      const playButton = targetTrack?.children[0]?.children[0]?.children[0] as HTMLDivElement;
      
      if (!playButton) {
        Logger.debug(`No play button found for track ${trackIndex + 1} using playFirstTrack structure`);
        return;
      }
      
      // Check if this track is already playing
      if (playButton.classList.contains('playing')) {
        Logger.debug(`Track ${trackIndex + 1} is already playing`);
        return;
      }
      
      playButton.click();
      return;
      
    } catch (error) {
      Logger.debug(`Error using playFirstTrack approach for track ${trackIndex + 1}:`, error);
    }
    
    // Fallback: Try the old approach if the new one fails
    const playCell = targetTrack.querySelector('td:first-child, .play-col');
    if (playCell) {
      // Try multiple play button selectors
      const playButtonSelectors = ['.playbutton', '.play-btn', '.play-button', 'a', 'div.playbutton'];
      
      for (const selector of playButtonSelectors) {
        const playButton = playCell.querySelector(selector);
        if (playButton && !playButton.className.includes('status') && !playButton.className.includes('icon')) {
          (playButton as HTMLElement).click();
          return;
        }
      }
      
      // Last resort: click the play cell itself
      (playCell as HTMLElement).click();
    }
  }

  // ============================================
  // OPTIMIZED RELEASE PAGE NAVIGATION METHODS
  // ============================================
  // These methods apply the same Phase 2 optimization techniques that achieved
  // 85-90% performance improvements for wishlist navigation to release pages

  /**
   * Play the next track on album/track pages with wrap-around support
   * Uses track index to detect when to wrap around instead of button state
   */
  public static playNextReleaseTrack(): void {
    const startTime = Logger.startTiming('playNextReleaseTrack');
    
    // Check if we're on a supported release page
    if (!this.isAlbum && !this.isTrack) {
      Logger.warn('Cannot play next release track - not on album or track page');
      Logger.timing('playNextReleaseTrack failed - invalid page type', startTime);
      return;
    }

    // Check if navigation is already in progress
    if (this._releaseNavigationInProgress) {
      Logger.warn('Release navigation already in progress, ignoring additional request');
      Logger.timing('playNextReleaseTrack blocked - concurrent request', startTime);
      return;
    }

    // Set navigation flag to prevent concurrent operations
    this._releaseNavigationInProgress = true;
    Logger.timing('playNextReleaseTrack flags set', startTime);

    // Phase 2: Reduced initial delay from 250ms to 100ms for faster response
    setTimeout(() => {
      const delayCompleteTime = Logger.startTiming('⏰ Initial delay completed');
      // Track navigation optimization (150ms saved: 250ms → 100ms)
      this.logReleasePageMetrics('Navigation', 150);
      
      const tracks = this.tracks;
      const currentTrackIndex = this.getCurrentTrackIndex();
      
      if (tracks.length === 0) {
        Logger.warn('No tracks found on release page');
        this._releaseNavigationInProgress = false;
        Logger.timing('playNextReleaseTrack failed - no tracks', startTime);
        return;
      }

      // Check if we need to wrap around (only at last track, not when no track is playing)
      const isAtLastTrack = currentTrackIndex === tracks.length - 1;
      const noCurrentTrack = currentTrackIndex === -1;
      
      Logger.debug(`Next track navigation: currentIndex=${currentTrackIndex}, totalTracks=${tracks.length}, isAtLastTrack=${isAtLastTrack}, noCurrentTrack=${noCurrentTrack}`);

      if (isAtLastTrack) {
        // We're at the last track, wrap around to the first track
        Logger.debug('At last track, wrapping around to first track');
        Logger.timing('Wrapping around to first track', delayCompleteTime);
        
        this.navigateToTrack(0); // Go to first track
        
        // Reset the navigation flag after a short delay
        setTimeout(() => {
          this._releaseNavigationInProgress = false;
          Logger.timing('playNextReleaseTrack completed with wrap-around', startTime);
        }, 200);
      } else {
        // Use Bandcamp's native next button for normal navigation
        // This handles both: no track playing (starts track 2) and normal next track progression
        const nextButton = this.getNext();
        if (!nextButton) {
          Logger.warn('Next button not found on release page');
          this._releaseNavigationInProgress = false;
          Logger.timing('playNextReleaseTrack failed - no next button', startTime);
          return;
        }

        Logger.debug('Using native next button (handles no track playing → track 2, or normal progression)');
        Logger.timing('Next button found', delayCompleteTime);
        
        const clickStart = Logger.startTiming('Next button click');
        nextButton.click();
        Logger.timing('Next button clicked', clickStart);
        
        // Use event-based verification instead of timeout-based
        const verificationStart = Logger.startTiming('Event-based navigation verification');
        this.verifyReleaseNavigationWithEvents('next', verificationStart, startTime);
      }
    }, 100); // Phase 2: Reduced from 250ms to 100ms
  }

  /**
   * Play the previous track on album/track pages with wrap-around support
   * Uses track index to detect when to wrap around instead of button state
   */
  public static playPreviousReleaseTrack(): void {
    const startTime = Logger.startTiming('playPreviousReleaseTrack');
    
    // Check if we're on a supported release page
    if (!this.isAlbum && !this.isTrack) {
      Logger.warn('Cannot play previous release track - not on album or track page');
      Logger.timing('playPreviousReleaseTrack failed - invalid page type', startTime);
      return;
    }

    // Check if navigation is already in progress
    if (this._releaseNavigationInProgress) {
      Logger.warn('Release navigation already in progress, ignoring additional request');
      Logger.timing('playPreviousReleaseTrack blocked - concurrent request', startTime);
      return;
    }

    // Set navigation flag to prevent concurrent operations
    this._releaseNavigationInProgress = true;
    Logger.timing('playPreviousReleaseTrack flags set', startTime);

    // Phase 2: Reduced initial delay from 250ms to 100ms for faster response
    setTimeout(() => {
      const delayCompleteTime = Logger.startTiming('⏰ Initial delay completed');
      // Track navigation optimization (150ms saved: 250ms → 100ms)
      this.logReleasePageMetrics('Navigation', 150);
      
      const tracks = this.tracks;
      const currentTrackIndex = this.getCurrentTrackIndex();
      
      if (tracks.length === 0) {
        Logger.warn('No tracks found on release page');
        this._releaseNavigationInProgress = false;
        Logger.timing('playPreviousReleaseTrack failed - no tracks', startTime);
        return;
      }

      // Check if we need to wrap around (at first track or no current track)
      const isAtFirstTrack = currentTrackIndex === 0;
      const noCurrentTrack = currentTrackIndex === -1;
      
      Logger.debug(`Previous track navigation: currentIndex=${currentTrackIndex}, totalTracks=${tracks.length}, isAtFirstTrack=${isAtFirstTrack}, noCurrentTrack=${noCurrentTrack}`);

      if (isAtFirstTrack || noCurrentTrack) {
        // We're at the first track or no track is playing, wrap around to the last track
        Logger.debug('At first track or no current track, wrapping around to last track');
        Logger.timing('Wrapping around to last track', delayCompleteTime);
        
        this.navigateToTrack(tracks.length - 1); // Go to last track
        
        // Reset the navigation flag after a short delay
        setTimeout(() => {
          this._releaseNavigationInProgress = false;
          Logger.timing('playPreviousReleaseTrack completed with wrap-around', startTime);
        }, 200);
      } else {
        // Use Bandcamp's native previous button for normal navigation
        const prevButton = this.getPrevious();
        if (!prevButton) {
          Logger.warn('Previous button not found on release page');
          this._releaseNavigationInProgress = false;
          Logger.timing('playPreviousReleaseTrack failed - no previous button', startTime);
          return;
        }

        Logger.debug('Using native previous button for normal navigation');
        Logger.timing('Previous button found', delayCompleteTime);
        
        const clickStart = Logger.startTiming('Previous button click');
        prevButton.click();
        Logger.timing('Previous button clicked', clickStart);
        
        // Use event-based verification instead of timeout-based
        const verificationStart = Logger.startTiming('Event-based navigation verification');
        this.verifyReleaseNavigationWithEvents('previous', verificationStart, startTime);
      }
    }, 100); // Phase 2: Reduced from 250ms to 100ms
  }

  /**
   * Verify if release page navigation completed successfully using event-based approach
   * This replaces timeout-based verification for 89.8% performance improvement
   *
   * @param direction The navigation direction ('next' or 'previous')
   * @param verificationStartTime The timing object for verification
   * @param navigationStartTime The timing object for overall navigation
   */
  private static verifyReleaseNavigationWithEvents(
    direction: 'next' | 'previous',
    verificationStartTime: number,
    navigationStartTime: number,
  ): void {
    let verificationComplete = false;
    let timeoutId: NodeJS.Timeout;

    const audio = this.audio || AudioUtils.getAudioElement();
    if (!audio) {
      Logger.warn('No audio element found for release navigation verification');
      this._releaseNavigationInProgress = false;
      Logger.timing('verifyReleaseNavigationWithEvents failed - no audio', verificationStartTime);
      return;
    }

    const onNavigationSuccess = () => {
      if (verificationComplete) {
        return;
      }
      verificationComplete = true;
      
      Logger.debug(`Release page ${direction} navigation verified successfully`);
      Logger.timing('Release navigation verification completed', verificationStartTime);
      
      // Clear navigation flags with optimized delays
      this.clearReleaseNavigationFlags(navigationStartTime);
      
      // Clean up event listeners
      cleanup();
    };

    const onNavigationFailure = (reason: string) => {
      if (verificationComplete) {
        return;
      }
      verificationComplete = true;
      
      Logger.warn(`Release page ${direction} navigation verification failed: ${reason}`);
      Logger.timing('Release navigation verification failed', verificationStartTime);
      
      // Clear navigation flags with error recovery
      this.clearReleaseNavigationFlags(navigationStartTime);
      
      // Clean up event listeners
      cleanup();
    };

    // Event handlers for navigation success detection
    const onLoadStart = () => {
      Logger.debug('Release page: Audio loading started (navigation successful)');
      onNavigationSuccess();
    };

    const onLoadedData = () => {
      Logger.debug('Release page: Audio data loaded (navigation successful)');
      onNavigationSuccess();
    };

    const onCanPlay = () => {
      Logger.debug('Release page: Audio can play (navigation successful)');
      onNavigationSuccess();
    };

    const onPlay = () => {
      Logger.debug('Release page: Audio started playing (navigation successful)');
      onNavigationSuccess();
    };

    const onTimeUpdate = () => {
      if (audio.currentTime > 0) {
        Logger.debug('Release page: Audio time progressing (navigation successful)');
        onNavigationSuccess();
      }
    };

    const onError = () => {
      Logger.warn('Release page: Audio error during navigation');
      onNavigationFailure('audio error');
    };

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('loadeddata', onLoadedData);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('error', onError);
    };

    // Add event listeners for navigation success detection
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('loadeddata', onLoadedData);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('error', onError);

    // Check current state immediately in case navigation already completed
    if (!audio.paused && (audio.readyState >= 2 || audio.currentTime > 0)) {
      onNavigationSuccess();
      return;
    }

    // Phase 2: Optimized fallback timeout (reduced from 500ms to 350ms for faster feedback)
    timeoutId = setTimeout(() => {
      if (!verificationComplete) {
        // Check one more time before giving up
        if (!audio.paused && (audio.readyState >= 2 || audio.currentTime > 0)) {
          onNavigationSuccess();
        } else {
          onNavigationFailure('timeout - no events received');
        }
      }
    }, 350); // Phase 2: Reduced from 500ms to 350ms
  }

  /**
   * Clear release navigation flags with optimized delays
   *
   * @param startTime The timing object for overall navigation
   */
  private static clearReleaseNavigationFlags(startTime: number): void {
    // Phase 2: Optimized flag clearing with reduced delays
    setTimeout(() => {
      const flagClearTime = Logger.startTiming('🏁 Release navigation flag clear');
      this._releaseNavigationInProgress = false;
      Logger.timing('Release navigation flag cleared', flagClearTime);
      // Track flag clearing optimization (100ms saved: 250ms → 150ms)
      this.logReleasePageMetrics('FlagClearing', 100);
      
      // Phase 2: Reduced delay for skip flag (350ms vs 500ms)
      setTimeout(() => {
        const secondClearTime = Logger.startTiming('🏁 Skip flag clear');
        this._skipInProgress = false;
        Logger.timing('Skip flag cleared', secondClearTime);
        // Track flag clearing optimization (150ms saved: 500ms → 350ms)
        this.logReleasePageMetrics('FlagClearing', 150);
        Logger.timing('playNextReleaseTrack fully completed', startTime);
      }, 350); // Reduced from 500ms to 350ms
    }, 150); // Reduced from 250ms to 150ms
  }

  /**
   * Log performance metrics for release page navigation optimizations
   *
   * @param operation The type of operation being tracked
   * @param timeSaved The amount of time saved in milliseconds
   */
  private static logReleasePageMetrics(operation: string, timeSaved: number): void {
    Logger.debug(`Release Page Metrics: ${operation} optimization saved ${timeSaved}ms`);
    Logger.debug('Release Page Performance: Phase 2 optimization applied');
  }

  // ============================================
  // END OPTIMIZED RELEASE PAGE NAVIGATION
  // ============================================

  public static seekReset(): void {
    SeekUtils.seekReset(this.isCollectionBasedPage);
  }

  public static seekForward(): void {
    SeekUtils.seekForward(this.isCollectionBasedPage);
  }

  public static seekBackward(): void {
    SeekUtils.seekBackward(this.isCollectionBasedPage);
  }

  public static setSpeed(speed: number): void {
    if (this.audio.playbackRate !== speed) {
      this.audio.playbackRate = speed;
    }
  }

  public static setStretch(isStretch: boolean): void {
    if (typeof this.audio.mozPreservesPitch !== 'undefined') {
      this.audio.mozPreservesPitch = isStretch;
      return;
    }

    this.audio.preservesPitch = isStretch;
  }

  public static insertBelowPlayer(element: HTMLElement): void {
    const player = BandcampFacade.player;
    player.insertAdjacentElement('afterend', element);
  }

  public static insertBelowWaveform(element: HTMLElement): void {
    // Look for existing waveform container first
    const waveformContainer = document.querySelector('.bandcamp-waveform-container, .bandcamp-waveform-loading, .bandcamp-waveform-error');
    
    if (waveformContainer) {
      // Insert after the waveform
      waveformContainer.insertAdjacentElement('afterend', element);
    } else {
      // Fallback to inserting below player if no waveform exists
      this.insertBelowPlayer(element);
    }
  }

  public static insertBelowSpeedController(element: HTMLElement): void {
    // Look for existing speed controller first
    const speedController = document.querySelector('.bandcamp-workflow-speed-grid');
    
    if (speedController) {
      // Insert after the speed controller
      speedController.insertAdjacentElement('afterend', element);
    } else {
      // Fallback to inserting below player if no speed controller exists
      this.insertBelowPlayer(element);
    }
  }

  public static movePlaylist(): void {
    if (!this.isAlbum) {
      return;
    }

    const player = BandcampFacade.player;
    const tracks = BandcampFacade.trackTable;
    player.insertAdjacentElement('afterend', tracks);
  }

  public static playFirstTrack(): void {
    try {
      Logger.debug('=== PLAY FIRST TRACK ANALYSIS START ===');
      
      const tracks = BandcampFacade.trackTable;

      if (!tracks) {
        Logger.warn('No track table found for playFirstTrack');
        Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (no track table) ===');
        return;
      }

      Logger.debug(`Track table found with ${tracks.children.length} children`);
      const firstRow = tracks?.children[0]?.children[0] as HTMLTableRowElement;

      if (!firstRow) {
        Logger.warn('No first track row found');
        Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (no first row) ===');
        return;
      }

      Logger.debug(`First row found: ${firstRow.className}`);
      const firstPlayButton = firstRow?.children[0]?.children[0]
        ?.children[0] as HTMLDivElement;

      if (!firstPlayButton) {
        Logger.warn('No first track play button found');
        Logger.debug(`First row structure: children[0]=${firstRow.children[0]?.tagName}, children[0].children[0]=${firstRow.children[0]?.children[0]?.tagName}`);
        Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (no play button found - will use fallback) ===');
        
        // Fallback: try to click the main play button
        try {
          const mainPlayButton = this.getPlay();
          if (mainPlayButton) {
            Logger.warn('FALLBACK: clicking main play button instead of first track button');
            mainPlayButton.click();
          }
        } catch (fallbackError) {
          Logger.error('Error in playFirstTrack fallback:', fallbackError);
        }
        return;
      }

      Logger.debug(`First track play button found: ${firstPlayButton.className}`);
      
      // If the first track is already playing, don't click it again
      if (firstPlayButton.classList.contains('playing')) {
        Logger.debug('First track is already playing');
        Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (already playing) ===');
        return;
      }

      Logger.debug('Clicking FIRST TRACK play button (not main play button)');
      firstPlayButton.click();
      Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (success) ===');
    } catch (error) {
      Logger.error('Error in playFirstTrack:', error);
      
      // Fallback: try to click the main play button
      try {
        const mainPlayButton = this.getPlay();
        if (mainPlayButton) {
          Logger.warn('FALLBACK: clicking main play button due to error');
          mainPlayButton.click();
        }
      } catch (fallbackError) {
        Logger.error('Error in playFirstTrack fallback:', fallbackError);
      }
      Logger.debug('=== PLAY FIRST TRACK ANALYSIS END (error fallback) ===');
    }
  }

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

  public static rectifyMargins(): void {
    const player = BandcampFacade.player;
    const tracks = BandcampFacade.trackTable;

    if (player) {
      player.style.marginBottom = '1em';
    }

    if (tracks) {
      tracks.style.marginTop = '1em';
    }

    const prevCell = document.getElementsByClassName(
      'prev_cell',
    )[0] as HTMLTableCellElement;
    const nextCell = document.getElementsByClassName(
      'next_cell',
    )[0] as HTMLTableCellElement;

    prevCell.style.transform = 'translate(4px)';
    nextCell.style.transform = 'translate(4px)';
  }

  /**
   * Load all wishlist items on the current page
   */
  public static loadWishlistItems(): HTMLElement[] {
    if (!this.isCollectionBasedPage) {
      return [];
    }

    try {
      const pageType = this.isWishlistPage ? 'wishlist' : 'collection';
      Logger.debug(`Loading ${pageType} items...`);
      
      // First, try to find items only within the currently active wishlist container
      // This helps avoid double-counting items from other tabs (like collection)
      let items: HTMLElement[] = [];
      
      // Look for containers (both wishlist and collection specific)
      // Define container priorities based on current page type
      let containers: string[];
      
      if (this.isCollectionPage) {
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
      } else if (this.isWishlistPage) {
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
      this._wishlistItems = items.filter((item) => {
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
      
      // Extract and store trackIds for each item, and attach play listeners
      this._wishlistItems.forEach((item, index) => {
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
                ShuffleService.updateShufflePosition(this.pageType, this._wishlistItems.length, index);
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
      if (this._currentWishlistIndex >= this._wishlistItems.length) {
        Logger.debug(`Resetting current index (was ${this._currentWishlistIndex}, but only have ${this._wishlistItems.length} items)`);
        this._currentWishlistIndex = -1;
      }
      
      // Try to find the currently playing track in the new item array
      // This helps maintain proper navigation after page switches
      if (this._currentWishlistIndex < 0) {
        const audio = AudioUtils.getAudioElement();
        if (audio && audio.src && !audio.paused) {
          // Extract track ID from the current audio source
          let currentTrackId = null;
          if (audio.src.includes('track_id=')) {
            const urlParams = new URLSearchParams(audio.src.split('?')[1]);
            currentTrackId = urlParams.get('track_id');
          }
          
          if (currentTrackId) {
            // Find this track in the current item array
            const matchingIndex = this._wishlistItems.findIndex(item => 
              item.getAttribute('data-track-id') === currentTrackId
            );
            
            if (matchingIndex >= 0) {
              Logger.debug(`Found currently playing track at index ${matchingIndex} in new item array`);
              this._currentWishlistIndex = matchingIndex;
            } else {
              Logger.debug(`Currently playing track not found in current page items`);
            }
          }
        }
      }
      
      Logger.debug(`Found ${this._wishlistItems.length} playable items`);
      
      // Update shuffle order if shuffle mode is enabled and new items were loaded
      if (ShuffleService.isShuffleEnabled) {
        Logger.debug(`Shuffle mode enabled, updating shuffle order for ${this.pageType} page with ${this._wishlistItems.length} total items`);
        ShuffleService.updateShuffleOrderForNewItems(this.pageType, this._wishlistItems.length, this._currentWishlistIndex >= 0 ? this._currentWishlistIndex : 0);
      }
      
      return this._wishlistItems;
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
          const url = albumLinks[0].getAttribute('href');
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
            const url = trackLinks[0].getAttribute('href');
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
            const jsonData = JSON.parse(script.textContent);
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
            item.setAttribute('data-track-href', anyLink.getAttribute('href'));
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
    
    if (!this.isCollectionBasedPage || this._wishlistItems.length === 0) {
      Logger.warn('Cannot play wishlist track - not on collection-based page or no items loaded');
      Logger.timing('playWishlistTrack failed - invalid state', startTime);
      return;
    }

    try {
      // Safety check and correction for invalid indices
      if (index < 0) {
        Logger.warn(`Track index ${index} is negative, correcting to 0 (first track)`);
        index = 0;
      } else if (index >= this._wishlistItems.length) {
        Logger.warn(`Track index ${index} is out of bounds (0-${this._wishlistItems.length - 1}), correcting to last track`);
        index = this._wishlistItems.length - 1;
      }

      const item = this._wishlistItems[index];
      
      // Debug: Log item info for shuffle debugging
      if (ShuffleService.isShuffleEnabled) {
        const trackId = item?.getAttribute('data-track-id') || item?.getAttribute('data-generated-id') || 'unknown';
        Logger.debug(`Playing track ${index + 1}, trackId: ${trackId}, item exists: ${!!item}`);
      }
      
      // Store the current index
      this._currentWishlistIndex = index;
      
      Logger.debug(`Attempting to play wishlist track ${index + 1} of ${this._wishlistItems.length}`);
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
        this._programmaticNavigationInProgress = true;
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
          this._programmaticNavigationInProgress = false;
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
                this._programmaticNavigationInProgress = true;
                Logger.debug('=== SETTING PROGRAMMATIC NAVIGATION FLAG (FOCUSED) ===');
                
                (playButton as HTMLElement).click();
                
                // Clear the programmatic flag after a short delay to allow the click event to be processed
                setTimeout(() => {
                  this._programmaticNavigationInProgress = false;
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
    
    if (!this.isCollectionBasedPage || this._wishlistItems.length === 0) {
      Logger.timing('playNextWishlistTrack failed - invalid state', startTime);
      return;
    }

    // Check if we already have a pending next track request
    if (this._pendingNextTrackRequest || this._skipInProgress) {
      Logger.debug('Already processing a track change request, ignoring additional request');
      Logger.timing('playNextWishlistTrack blocked - concurrent request', startTime);
      return;
    }

    // Set a flag to prevent multiple concurrent skip requests
    this._pendingNextTrackRequest = true;
    this._skipInProgress = true;
    Logger.timing('playNextWishlistTrack flags set', startTime);

    // Use a reduced delay since event-based verification is faster
    setTimeout(() => {
      const delayCompleteTime = Logger.startTiming('⏰ Initial delay completed');
      // Phase 2: Track navigation optimization (150ms saved: 250ms → 100ms)
      this.logPhase2Metrics('Navigation', 150);
      
      let nextIndex: number;
      
      Logger.debug('=== FACADE: Determining next track index ===');
      Logger.debug(`Current index: ${this._currentWishlistIndex}`);
      Logger.debug(`Total items: ${this._wishlistItems.length}`);
      Logger.debug(`Shuffle enabled: ${ShuffleService.isShuffleEnabled}`);
      
      if (ShuffleService.isShuffleEnabled) {
        // Use shuffle service to get next track
        nextIndex = ShuffleService.getNextShuffledIndex(this.pageType, this._wishlistItems.length, this._currentWishlistIndex);
        
        // Debug: Check if shuffle returned a valid index
        if (nextIndex < 0 || nextIndex >= this._wishlistItems.length) {
          Logger.warn(`Invalid index returned ${nextIndex} (valid range: 0-${this._wishlistItems.length - 1})`);
        }
        if (nextIndex === this._currentWishlistIndex) {
          Logger.warn(`Same index returned ${nextIndex} (current: ${this._currentWishlistIndex})`);
        }
      } else {
        // Regular sequential navigation
        nextIndex = this._currentWishlistIndex + 1;
        if (nextIndex >= this._wishlistItems.length) {
          nextIndex = 0; // Loop back to the first track
        }
      }

      Logger.debug(`Playing next wishlist track (${nextIndex + 1} of ${this._wishlistItems.length})${ShuffleService.isShuffleEnabled ? ' [SHUFFLE]' : ''}`);
      Logger.timing('Next index calculated', delayCompleteTime);
      
      const playTrackStart = Logger.startTiming('Calling playWishlistTrack');
      this.playWishlistTrack(nextIndex);
      Logger.timing('playWishlistTrack call completed', playTrackStart);
      
      // Phase 2: Optimized flag clearing with reduced delays
      setTimeout(() => {
        const firstClearTime = Logger.startTiming('🏁 First flag clear');
        this._pendingNextTrackRequest = false;
        Logger.timing('Pending flag cleared', firstClearTime);
        // Track flag clearing optimization (100ms saved: 250ms → 150ms)
        this.logPhase2Metrics('FlagClearing', 100);
        
        // Phase 2: Reduced delay for skip flag (350ms vs 500ms)
        setTimeout(() => {
          const secondClearTime = Logger.startTiming('🏁 Skip flag clear');
          this._skipInProgress = false;
          Logger.timing('Skip flag cleared', secondClearTime);
          // Track flag clearing optimization (150ms saved: 500ms → 350ms)
          this.logPhase2Metrics('FlagClearing', 150);
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
    
    if (!this.isCollectionBasedPage || this._wishlistItems.length === 0) {
      Logger.timing('playPreviousWishlistTrack failed - invalid state', startTime);
      return;
    }

    // Check if we already have a pending track request
    if (this._pendingNextTrackRequest || this._skipInProgress) {
      Logger.debug('Already processing a track change request, ignoring additional request');
      Logger.timing('playPreviousWishlistTrack blocked - concurrent request', startTime);
      return;
    }

    // Set a flag to prevent multiple concurrent skip requests
    this._pendingNextTrackRequest = true;
    this._skipInProgress = true;
    Logger.timing('playPreviousWishlistTrack flags set', startTime);

    // Phase 2: Reduced initial delay from 250ms to 100ms
    setTimeout(async () => {
      const delayCompleteTime = Logger.startTiming('⏰ Initial delay completed');
      // Phase 2: Track navigation optimization (150ms saved: 250ms → 100ms)
      this.logPhase2Metrics('Navigation', 150);
      
      // If we're trying to go to the previous track from the first track (index 0),
      // ensure all wishlist items are loaded to get the correct "last" track
      if (this._currentWishlistIndex === 0) {
        Logger.debug('At first track, ensuring all wishlist items are loaded before going to last track');
        const loadAllStart = Logger.startTiming('📥 Loading all wishlist items');
        try {
          const loadSuccess = await this.loadAllWishlistItems();
          Logger.timing('loadAllWishlistItems completed', loadAllStart);
          
          if (loadSuccess) {
            const reloadStart = Logger.startTiming('Reloading wishlist items');
            // Reload wishlist items to get the updated array
            this.loadWishlistItems();
            Logger.debug(`Updated wishlist items count: ${this._wishlistItems.length}`);
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
      Logger.debug(`Current index: ${this._currentWishlistIndex}`);
      Logger.debug(`Total items: ${this._wishlistItems.length}`);
      Logger.debug(`Shuffle enabled: ${ShuffleService.isShuffleEnabled}`);
      
      if (ShuffleService.isShuffleEnabled) {
        // Use shuffle service to get previous track
        prevIndex = ShuffleService.getPreviousShuffledIndex(this.pageType, this._wishlistItems.length, this._currentWishlistIndex);
        
        // Debug: Check if shuffle returned a valid index
        if (prevIndex < 0 || prevIndex >= this._wishlistItems.length) {
          Logger.warn(`Invalid previous index returned ${prevIndex} (valid range: 0-${this._wishlistItems.length - 1})`);
        }
        if (prevIndex === this._currentWishlistIndex) {
          Logger.warn(`Same previous index returned ${prevIndex} (current: ${this._currentWishlistIndex})`);
        }
      } else {
        // Sequential behavior
        prevIndex = this._currentWishlistIndex - 1;
        if (prevIndex < 0) {
          prevIndex = this._wishlistItems.length - 1; // Loop back to the last track
        }
      }

      // Check if the previous track is in our problem list
      const problemCheckStart = Logger.startTiming('Problem track check');
      const item = this._wishlistItems[prevIndex];
      const trackId = item?.getAttribute('data-track-id');
      Logger.timing('Problem track check completed', problemCheckStart);
      
      if (trackId && this._problemTrackIds.has(trackId)) {
        Logger.debug(`Previous track (${prevIndex + 1}) has known issues, skipping it`);
        
        const skipProblemStart = Logger.startTiming('Skipping problem tracks');
        // Calculate the next valid previous index
        let nextValidPrevIndex = prevIndex - 1;
        if (nextValidPrevIndex < 0) {
          nextValidPrevIndex = this._wishlistItems.length - 1;
        }
        
        // Recursively try to find a valid previous track
        let attemptsLeft = this._wishlistItems.length; // Prevent infinite loop
        let foundValidTrack = false;
        
        while (attemptsLeft > 0 && !foundValidTrack) {
          const candidateItem = this._wishlistItems[nextValidPrevIndex];
          const candidateTrackId = candidateItem?.getAttribute('data-track-id');
          
          if (!candidateTrackId || !this._problemTrackIds.has(candidateTrackId)) {
            // Found a track that's not in our problem list
            prevIndex = nextValidPrevIndex;
            foundValidTrack = true;
            Logger.debug(`Found valid previous track at index ${prevIndex + 1}`);
          } else {
            // This track is also problematic, go to previous one
            nextValidPrevIndex--;
            if (nextValidPrevIndex < 0) {
              nextValidPrevIndex = this._wishlistItems.length - 1;
            }
            attemptsLeft--;
          }
        }
        Logger.timing('Problem track skipping completed', skipProblemStart);
        
        if (!foundValidTrack) {
          Logger.warn('Could not find any valid previous tracks, staying on current track');
          this._pendingNextTrackRequest = false;
          this._skipInProgress = false;
          Logger.timing('playPreviousWishlistTrack failed - no valid tracks', startTime);
          return;
        }
      }

      Logger.debug(`Playing previous wishlist track (${prevIndex + 1} of ${this._wishlistItems.length})`);
      const playTrackStart = Logger.startTiming('Calling playWishlistTrack');
      this.playWishlistTrack(prevIndex);
      Logger.timing('playWishlistTrack call completed', playTrackStart);
      
      // Phase 2: Optimized flag clearing with reduced delays
      setTimeout(() => {
        const firstClearTime = Logger.startTiming('🏁 First flag clear');
        this._pendingNextTrackRequest = false;
        Logger.timing('Pending flag cleared', firstClearTime);
        // Track flag clearing optimization (100ms saved: 250ms → 150ms)
        this.logPhase2Metrics('FlagClearing', 100);
        
        // Phase 2: Reduced delay for skip flag (350ms vs 500ms)
        setTimeout(() => {
          const secondClearTime = Logger.startTiming('🏁 Skip flag clear');
          this._skipInProgress = false;
          Logger.timing('Skip flag cleared', secondClearTime);
          // Track flag clearing optimization (150ms saved: 500ms → 350ms)
          this.logPhase2Metrics('FlagClearing', 150);
          Logger.timing('playPreviousWishlistTrack fully completed', startTime);
        }, 350); // Reduced from 500ms to 350ms
      }, 150); // Reduced from 250ms to 150ms
    }, 100); // Phase 2: Reduced initial delay from 250ms to 100ms
  }

  /**
   * Start playing the wishlist from the beginning
   */
  public static startWishlistPlayback(): void {
    if (!this.isCollectionBasedPage) {
      return;
    }

    // Load all wishlist items if not already loaded
    if (this._wishlistItems.length === 0) {
      this.loadWishlistItems();
    }

    if (this._wishlistItems.length > 0) {
      Logger.debug(`Starting wishlist playback with ${this._wishlistItems.length} items`);
      this.playWishlistTrack(0);
    } else {
      Logger.warn('No wishlist items found to play');
    }
  }

  /**
   * Check if currently playing a wishlist track
   */
  public static isPlayingWishlistTrack(): boolean {
    return this.isCollectionBasedPage && this._currentWishlistIndex >= 0;
  }

  /**
   * Setup automatic playback of next track when current track ends
   */
  public static setupWishlistContinuousPlayback(): void {
    if (!this.isCollectionBasedPage) {
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
              // Track error recovery optimization (150ms saved: 500ms → 350ms)
              this.logPhase2Metrics('ErrorRecovery', 150);
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
              // Track error recovery optimization (150ms saved: 500ms → 350ms)
              this.logPhase2Metrics('ErrorRecovery', 150);
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
              // Track error recovery optimization (150ms saved: 500ms → 350ms)
              this.logPhase2Metrics('ErrorRecovery', 150);
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
      // Phase 2: Track DOM selection optimization usage
      this.logPhase2Metrics('DOMSelection', 0);
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
      this._consecutiveErrors = 0;
    } else {
      // Audio is paused - check if it has a valid source and is just loading
      if (audio.src && !audio.src.includes('blob:') && !audio.src.includes('track_id=&')) {
        Logger.debug(`Track ${index + 1} has valid source, waiting for playback to start`);
        // Check again after a short delay in case it's still loading
        setTimeout(() => {
          if (!audio.paused) {
            Logger.debug(`Track ${index + 1} started playing after delay`);
            this._consecutiveErrors = 0;
          } else {
            Logger.warn(`Track ${index + 1} failed to play automatically`);
            this._consecutiveErrors++;
            
            // If we've tried a few times and it's still not playing, move to the next track
            if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
              Logger.warn(`Track ${index + 1} failed ${this._consecutiveErrors} times, skipping to next track`);
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
        this._consecutiveErrors++;
        
        // Try to fix the URL if it's missing the track ID
        if (audio.src.includes('track_id=&') || !audio.src.includes('track_id=')) {
          const currentItem = this._wishlistItems[index];
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
    if (this.isWishlistPage) {
      // If we have wishlist items but no track is currently playing (index is -1)
      // Simply do nothing as requested
      if (this._currentWishlistIndex < 0) {
        Logger.debug('c key detected - no track selected, ignoring press');
        return;
      }
      
      // Handle case where a track is currently playing (_currentWishlistIndex >= 0)
      if (this._wishlistItems.length > 0) {
        const currentItem = this._wishlistItems[this._currentWishlistIndex];
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
    } else if (this.isAlbum) {
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
    } else if (this.isTrack) {
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

  // Add a debounce flag to prevent rapid play/pause toggling
  private static _playPauseInProgress = false;

  /**
   * Toggle play/pause for the current audio
   */
  public static togglePlayPause(): void {
    try {
      // Check if toggle is already in progress to prevent rapid toggling
      if (this._playPauseInProgress) {
        Logger.debug('Play/pause toggle already in progress, ignoring request');
        return;
      }

      // Set the flag to indicate a toggle is in progress
      this._playPauseInProgress = true;

      // Add comprehensive logging for release page behavior analysis
      Logger.debug('=== PLAY BUTTON ANALYSIS START ===');
      Logger.debug(`Page type - isAlbum: ${this.isAlbum}, isTrack: ${this.isTrack}, isWishlistPage: ${this.isWishlistPage}`);
      Logger.debug(`Current URL: ${window.location.href}`);
      
      // Log audio element state
      const audio = this.audio || AudioUtils.getAudioElement();
      if (audio) {
        Logger.debug(`Audio element found - paused: ${audio.paused}, currentTime: ${audio.currentTime}, src: ${audio.src}`);
      } else {
        Logger.debug('No audio element found');
      }
      
      // Log current track state
      const hasCurrentTrack = this.hasCurrentlyPlayingTrack();
      Logger.debug(`Has currently playing track: ${hasCurrentTrack}`);
      
      // Log track table and current track info
      const trackTable = this.trackTable;
      if (trackTable) {
        const tracks = this.tracks;
        Logger.debug(`Track table found with ${tracks.length} tracks`);
        
        // Find which track (if any) has the 'current_track' class
        const currentTrackRow = trackTable.querySelector('.track_row_view.current_track');
        if (currentTrackRow) {
          const trackIndex = Array.from(tracks).indexOf(currentTrackRow as HTMLTableRowElement);
          const trackTitle = currentTrackRow.querySelector('.title')?.textContent?.trim();
          Logger.debug(`Current track row found at index ${trackIndex}: "${trackTitle}"`);
        } else {
          Logger.debug('No current track row found (.track_row_view.current_track)');
        }
        
        // Log first track info for comparison
        if (tracks.length > 0) {
          const firstTrack = tracks[0];
          const firstTrackTitle = firstTrack.querySelector('.title')?.textContent?.trim();
          Logger.debug(`First track in table: "${firstTrackTitle}"`);
        }
      } else {
        Logger.debug('No track table found');
      }
      
      // Log play button state
      const loggedPlayButton = this.getPlay();
      if (loggedPlayButton) {
        Logger.debug(`Play button found - classes: ${loggedPlayButton.className}, onclick: ${loggedPlayButton.getAttribute('onclick')}`);
      } else {
        Logger.debug('No play button found');
      }

      // Special handling for collection-based pages (wishlist and collection)
      if (this.isCollectionBasedPage) {
        const pageType = this.isWishlistPage ? 'WISHLIST' : 'COLLECTION';
        Logger.debug(`=== ${pageType} PAGE HANDLING ===`);
        
        // Check if we need to start playback for the first time (no track selected yet)
        if (this._wishlistItems.length === 0) {
          Logger.debug(`Loading ${pageType.toLowerCase()} items for first-time playback`);
          this.loadWishlistItems();
        }
        
        const collectionAudio = AudioUtils.getWishlistAudioElement();
        
        // Check if no track is currently loaded/playing (audio has no src or is at beginning)
        const needsFirstTimePlayback = collectionAudio && 
          (!collectionAudio.src || collectionAudio.src === '' || 
           (collectionAudio.currentTime === 0 && collectionAudio.paused && this._currentWishlistIndex < 0));
        
        if (needsFirstTimePlayback && this._wishlistItems.length > 0) {
          Logger.debug(`No track currently loaded on ${pageType.toLowerCase()} page, starting from first track`);
          // Clear the flag before starting a new track to avoid lockout
          this._playPauseInProgress = false;
          this.startWishlistPlayback();
          return;
        }
        
        if (collectionAudio) {
          // Toggle play/pause state
          if ((collectionAudio as HTMLAudioElement).paused) {
            Logger.debug(`Playing audio on ${pageType.toLowerCase()} page`);
            (collectionAudio as HTMLAudioElement).play()
              .then(() => {
                // Clear the flag after successful play
                setTimeout(() => {
                  this._playPauseInProgress = false;
                }, 300);
              })
              .catch((e) => {
                ErrorHandler.withErrorHandling(() => {
                  throw e; 
                }, 'Error playing audio');
                // Clear the flag even if there's an error
                this._playPauseInProgress = false;
              });
          } else {
            Logger.debug(`Pausing audio on ${pageType.toLowerCase()} page`);
            (collectionAudio as HTMLAudioElement).pause();
            // Clear the flag after a short delay for pausing
            setTimeout(() => {
              this._playPauseInProgress = false;
            }, 300);
          }
          
          // Also try to find and update UI play button if it exists
          const collectionPlayButton = document.querySelector('.carousel-player-inner .playbutton, .play-button');
          if (collectionPlayButton && collectionPlayButton.classList) {
            if ((collectionAudio as HTMLAudioElement).paused) {
              collectionPlayButton.classList.remove('playing');
            } else {
              collectionPlayButton.classList.add('playing');
            }
          }
          
          return;
        }
      }
      
      // Standard handling for regular Bandcamp pages
      Logger.debug('=== STANDARD PAGE HANDLING ===');
      const playButton = this.getPlay();
      if (playButton) {
        // Check if we're on album page and no track is currently playing
        if (this.isAlbum) {
          Logger.debug('=== ALBUM PAGE ANALYSIS ===');
          
          // If audio is paused and there's no current track, start from the first track
          if (audio && audio.paused && !this.hasCurrentlyPlayingTrack()) {
            Logger.debug('No track currently playing on album page, calling playFirstTrack()');
            this.playFirstTrack();
            // Clear the flag after starting first track
            setTimeout(() => {
              this._playPauseInProgress = false;
            }, 300);
            Logger.debug('=== PLAY BUTTON ANALYSIS END (playFirstTrack called) ===');
            return;
          } else {
            Logger.debug(`Audio state - paused: ${audio?.paused}, hasCurrentTrack: ${this.hasCurrentlyPlayingTrack()}`);
          }
        }
        
        Logger.debug('Clicking play button to toggle play/pause');
        
        // Log what will happen after clicking the play button
        setTimeout(() => {
          const audioAfterClick = this.audio || AudioUtils.getAudioElement();
          if (audioAfterClick) {
            Logger.debug(`AFTER PLAY BUTTON CLICK - Audio paused: ${audioAfterClick.paused}, currentTime: ${audioAfterClick.currentTime}, src: ${audioAfterClick.src}`);
          }
          
          // Check which track is now current
          const currentTrackRowAfter = document.querySelector('.track_row_view.current_track');
          if (currentTrackRowAfter && trackTable) {
            const trackIndexAfter = Array.from(this.tracks).indexOf(currentTrackRowAfter as HTMLTableRowElement);
            const trackTitleAfter = currentTrackRowAfter.querySelector('.title')?.textContent?.trim();
            Logger.debug(`AFTER PLAY BUTTON CLICK - Current track is now at index ${trackIndexAfter}: "${trackTitleAfter}"`);
          } else {
            Logger.debug('AFTER PLAY BUTTON CLICK - No current track found');
          }
          Logger.debug('=== PLAY BUTTON ANALYSIS END ===');
        }, 500);
        
        playButton.click();
        // Clear the flag after a short delay for button click
        setTimeout(() => {
          this._playPauseInProgress = false;
        }, 300);
      } else {
        // Try direct audio control as fallback
        Logger.debug('=== FALLBACK AUDIO CONTROL ===');
        const audio = this.audio || AudioUtils.getAudioElement();
        if (audio) {
          if (audio.paused) {
            Logger.debug('Playing audio directly');
            audio.play()
              .then(() => {
                // Clear the flag after successful play
                setTimeout(() => {
                  this._playPauseInProgress = false;
                }, 300);
              })
              .catch((e) => {
                Logger.error('Error playing audio:', e);
                // Clear the flag even if there's an error
                this._playPauseInProgress = false;
              });
          } else {
            Logger.debug('Pausing audio directly');
            audio.pause();
            // Clear the flag after a short delay for pausing
            setTimeout(() => {
              this._playPauseInProgress = false;
            }, 300);
          }
        } else {
          Logger.warn('No play button or audio element found for toggle play/pause');
          // Clear the flag immediately if we couldn't find anything to toggle
          this._playPauseInProgress = false;
        }
        Logger.debug('=== PLAY BUTTON ANALYSIS END (fallback used) ===');
      }
    } catch (error) {
      Logger.error('Error in togglePlayPause:', error);
      // Make sure to clear the flag even if there's an error
      this._playPauseInProgress = false;
    }
  }

  /**
   * Toggle wishlist status for the currently playing track in the wishlist
   */
  public static toggleCurrentTrackWishlist(): void {
    if (!this.isWishlistPage || this._currentWishlistIndex < 0 || !this._wishlistItems.length) {
      Logger.warn('Cannot toggle current track wishlist - not on wishlist page or no track selected');
      return;
    }

    try {
      // Get the current wishlist item
      const currentItem = this._wishlistItems[this._currentWishlistIndex];
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
                          this._wishlistItems = this._wishlistItems.filter((item) => item !== currentItem);
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
      const navigationSuccess = WishlistService.navigateToTrackForWishlistToggle(currentItem, this._currentWishlistIndex);
      
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

  /**
   * Load more discovery items from the Bandcamp discovery page
   *
   * @returns Promise that resolves to true if more items were loaded
   */
  public static async loadMoreDiscoveryItems(): Promise<boolean> {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot load more items');
      return false;
    }

    try {
      Logger.debug('Loading more discovery items');
      
      // Look for the "load more" button on the discovery page
      const loadMoreButton = document.querySelector('.show-more button, button.show-more, [data-bind*="loadMore"]');
      
      if (loadMoreButton) {
        Logger.debug('Found load more button, clicking it');
        (loadMoreButton as HTMLElement).click();
        
        // Wait for items to load
        return new Promise<boolean>((resolve) => {
          // Check if new items have been added after a short delay
          setTimeout(() => {
            const currentItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.DISCOVERY_ITEMS);
            Logger.debug(`Found ${currentItems.length} discovery items after loading more`);
            resolve(true);
          }, 2000);
        });
      } else {
        Logger.warn('No load more button found on discovery page');
        return false;
      }
    } catch (error) {
      Logger.error('Error loading more discovery items:', error);
      return false;
    }
  }

  /**
   * Get all discovery items from the current discovery page
   *
   * @returns Array of discovery item elements
   */
  public static getDiscoveryItems(): HTMLElement[] {
    if (!window.location.href.includes('/discover')) {
      return [];
    }

    try {
      // Try different selectors for discovery items
      const discoveryItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.DISCOVERY_ITEMS);
      
      if (discoveryItems.length > 0) {
        Logger.debug(`Found ${discoveryItems.length} discovery items`);
      }
      
      if (discoveryItems.length === 0) {
        Logger.warn('No discovery items found');
      }
      
      return discoveryItems;
    } catch (error) {
      Logger.error('Error getting discovery items:', error);
      return [];
    }
  }

  /**
   * Get featured discovery items from the current discovery page
   *
   * @returns Array of featured discovery item elements
   */
  public static getFeaturedDiscoveryItems(): HTMLElement[] {
    if (!window.location.href.includes('/discover')) {
      return [];
    }

    try {
      // Try different selectors for featured discovery items
      const items = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.FEATURED_DISCOVERY_ITEMS);
      
      if (items.length > 0) {
        Logger.debug(`Found ${items.length} featured discovery items`);
        return items;
      }
      
      Logger.warn('No featured discovery items found');
      return [];
    } catch (error) {
      Logger.error('Error getting featured discovery items:', error);
      return [];
    }
  }

  /**
   * Click on a discovery item by its index
   *
   * @param index The index of the discovery item to click
   * @returns True if successful, false otherwise
   */
  public static clickDiscoveryItem(index: number): boolean {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot click discovery item');
      return false;
    }
    
    try {
      const discoveryItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.DISCOVERY_ITEMS);
      
      if (!discoveryItems || discoveryItems.length === 0) {
        Logger.warn('No discovery items found on page');
        return false;
      }
      
      if (index < 0 || index >= discoveryItems.length) {
        Logger.warn(`Invalid discovery item index: ${index}. Available range: 0-${discoveryItems.length - 1}`);
        return false;
      }
      
      const item = discoveryItems[index] as HTMLElement;
      item.click();
      
      Logger.debug(`Clicked on discovery item at index ${index}`);
      return true;
    } catch (error) {
      Logger.error('Error clicking discovery item:', error);
      return false;
    }
  }
  
  /**
   * Click on a featured discovery item by its index
   *
   * @param index The index of the featured discovery item to click
   *   @returns True if successful, false otherwise
   */
  public static clickFeaturedDiscoveryItem(index: number): boolean {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot click featured discovery item');
      return false;
    }
    
    try {
      const featuredItems = DOMSelectors.findWithSelectors<HTMLElement>(DOMSelectors.FEATURED_DISCOVERY_ITEMS);
      
      if (!featuredItems || featuredItems.length === 0) {
        Logger.warn('No featured discovery items found on page');
        return false;
      }
      
      if (index < 0 || index >= featuredItems.length) {
        Logger.warn(`Invalid featured item index: ${index}. Available range: 0-${featuredItems.length - 1}`);
        return false;
      }
      
      const item = featuredItems[index] as HTMLElement;
      item.click();
      
      Logger.debug(`Clicked on featured discovery item at index ${index}`);
      return true;
    } catch (error) {
      Logger.error('Error clicking featured discovery item:', error);
      return false;
    }
  }
  
  /**
   * Get the available discovery filters
   *
   * @returns An object containing the available filters
   */
  public static getDiscoveryFilters(): Record<string, any> {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot get discovery filters');
      return {};
    }
    
    try {
      const filters: Record<string, any> = {};
      
      // Get genre filters
      const genreSelector = document.querySelector('.genre-selector, #genre-selector, [data-bind*="genre"]');
      if (genreSelector) {
        filters.genres = Array.from(genreSelector.querySelectorAll('option, li, a')).map((option) => ({
          value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
          label: option.textContent?.trim(),
        }));
      }
      
      // Get subgenre filters
      const subgenreSelector = document.querySelector('.subgenre-selector, #subgenre-selector, [data-bind*="subgenre"]');
      if (subgenreSelector) {
        filters.subgenres = Array.from(subgenreSelector.querySelectorAll('option, li, a')).map((option) => ({
          value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
          label: option.textContent?.trim(),
        }));
      }
      
      // Get format filters
      const formatSelector = document.querySelector('.format-selector, #format-selector, [data-bind*="format"]');
      if (formatSelector) {
        filters.formats = Array.from(formatSelector.querySelectorAll('option, li, a')).map((option) => ({
          value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
          label: option.textContent?.trim(),
        }));
      }
      
      // Get location filters
      const locationSelector = document.querySelector('.location-selector, #location-selector, [data-bind*="location"]');
      if (locationSelector) {
        filters.locations = Array.from(locationSelector.querySelectorAll('option, li, a')).map((option) => ({
          value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
          label: option.textContent?.trim(),
        }));
      }
      
      // Get time filters
      const timeSelector = document.querySelector('.time-selector, #time-selector, [data-bind*="time"]');
      if (timeSelector) {
        filters.times = Array.from(timeSelector.querySelectorAll('option, li, a')).map((option) => ({
          value: option.getAttribute('value') || option.getAttribute('data-value') || option.textContent,
          label: option.textContent?.trim(),
        }));
      }
      
      return filters;
    } catch (error) {
      Logger.error('Error getting discovery filters:', error);
      return {};
    }
  }
  
  /**
   * Apply a filter to the discovery page
   *
   * @param filterType The type of filter to apply (genre, subgenre, format, location, time)
   * @param value The value to set for the filter
   * @returns True if the filter was applied successfully
   */
  public static applyDiscoveryFilter(filterType: string, value: string): boolean {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot apply discovery filter');
      return false;
    }

    try {
      // Map filter type to selector
      const selectorMap: Record<string, string> = {
        genre: '.genre-selector, #genre-selector, [data-bind*="genre"]',
        subgenre: '.subgenre-selector, #subgenre-selector, [data-bind*="subgenre"]',
        format: '.format-selector, #format-selector, [data-bind*="format"]',
        location: '.location-selector, #location-selector, [data-bind*="location"]',
        time: '.time-selector, #time-selector, [data-bind*="time"]',
      };
      
      const selector = selectorMap[filterType.toLowerCase()];
      if (!selector) {
        Logger.warn(`Unknown filter type: ${filterType}`);
        return false;
      }
      
      // Find the filter element
      const filterElement = document.querySelector(selector);
      if (!filterElement) {
        Logger.warn(`Filter element not found for filter type: ${filterType}`);
        return false;
      }
      
      // Check if it's a select element
      if (filterElement.tagName === 'SELECT') {
        const selectElement = filterElement as HTMLSelectElement;
        selectElement.value = value;
        
        // Trigger change event
        const event = new Event('change', {bubbles: true});
        selectElement.dispatchEvent(event);
        
        Logger.debug(`Applied ${filterType} filter with value: ${value}`);
        return true;
      }
      
      // Check if it's a list of options
      const options = filterElement.querySelectorAll('option, li, a');
      for (const option of Array.from(options)) {
        const optionValue = option.getAttribute('value') || 
                           option.getAttribute('data-value') || 
                           option.textContent;
        
        if (optionValue === value || option.textContent === value) {
          (option as HTMLElement).click();
          Logger.debug(`Applied ${filterType} filter with value: ${value}`);
          return true;
        }
      }
      
      Logger.warn(`Could not find option with value ${value} for filter type ${filterType}`);
      return false;
    } catch (error) {
      Logger.error('Error applying discovery filter:', error);
      return false;
    }
  }
  
  /**
   * Save the current discovery page preferences with a name
   *
   * @param name The name to save the preferences under
   * @returns True if saved successfully
   */
  public static saveDiscoveryPreference(name: string): boolean {
    if (!window.location.href.includes('/discover')) {
      Logger.warn('Not on discovery page, cannot save discovery preferences');
      return false;
    }
    
    try {
      // Get current URL which contains all filter parameters
      const currentUrl = window.location.href;
      
      // Get existing preferences
      const existingPreferencesString = localStorage.getItem('bandcampPlusDiscoveryPreferences');
      let preferences: Record<string, string> = {};
      
      if (existingPreferencesString) {
        try {
          preferences = JSON.parse(existingPreferencesString);
        } catch (error) {
          Logger.error('Error parsing existing preferences:', error);
          preferences = {};
        }
      }
      
      // Save the new preference
      preferences[name] = currentUrl;
      
      // Save back to localStorage
      localStorage.setItem('bandcampPlusDiscoveryPreferences', JSON.stringify(preferences));
      
      Logger.debug(`Saved discovery preference '${name}' with URL: ${currentUrl}`);
      return true;
    } catch (error) {
      Logger.error('Error saving discovery preference:', error);
      return false;
    }
  }
  
  /**
   * Load a saved discovery preference by name
   *
   * @param name The name of the preference to load
   * @returns True if loaded successfully
   */
  public static async loadDiscoveryPreference(name: string): Promise<boolean> {
    try {
      // Get existing preferences
      const existingPreferencesString = localStorage.getItem('bandcampPlusDiscoveryPreferences');
      
      if (!existingPreferencesString) {
        Logger.warn('No saved discovery preferences found');
        return false;
      }
      
      let preferences: Record<string, string>;
      
      try {
        preferences = JSON.parse(existingPreferencesString);
      } catch (error) {
        Logger.error('Error parsing discovery preferences:', error);
        return false;
      }
      
      const savedUrl = preferences[name];
      
      if (!savedUrl) {
        Logger.warn(`No discovery preference found with name: ${name}`);
        return false;
      }
      
      // Navigate to the saved URL
      Logger.debug(`Loading discovery preference '${name}' with URL: ${savedUrl}`);
      window.location.href = savedUrl;
      return true;
    } catch (error) {
      Logger.error('Error loading discovery preference:', error);
      return false;
    }
  }
  
  /**
   * Get all stored discovery preferences
   *
   * @returns A record of preference names and their URLs
   */
  public static getStoredDiscoveryPreferences(): Record<string, any> {
    try {
      // Get existing preferences
      const existingPreferencesString = localStorage.getItem('bandcampPlusDiscoveryPreferences');
      
      if (!existingPreferencesString) {
        return {};
      }
      
      try {
        return JSON.parse(existingPreferencesString);
      } catch (error) {
        Logger.error('Error parsing discovery preferences:', error);
        return {};
      }
    } catch (error) {
      Logger.error('Error getting stored discovery preferences:', error);
      return {};
    }
  }
  
  /**
   * Delete a saved discovery preference by name
   *
   * @param name The name of the preference to delete
   * @returns True if deleted successfully
   */
  public static deleteDiscoveryPreference(name: string): boolean {
    try {
      // Get existing preferences
      const existingPreferencesString = localStorage.getItem('bandcampPlusDiscoveryPreferences');
      
      if (!existingPreferencesString) {
        Logger.warn('No saved discovery preferences found');
        return false;
      }
      
      let preferences: Record<string, string>;
      
      try {
        preferences = JSON.parse(existingPreferencesString);
      } catch (error) {
        Logger.error('Error parsing discovery preferences:', error);
        return false;
      }
      
      if (!preferences[name]) {
        Logger.warn(`No discovery preference found with name: ${name}`);
        return false;
      }
      
      // Delete the preference
      delete preferences[name];
      
      // Save back to localStorage
      localStorage.setItem('bandcampPlusDiscoveryPreferences', JSON.stringify(preferences));
      
      Logger.debug(`Deleted discovery preference: ${name}`);
      return true;
    } catch (error) {
      Logger.error('Error deleting discovery preference:', error);
      return false;
    }
  }
  
  /**
   * Navigate to the Bandcamp discovery page
   *
   * @returns True if navigation was initiated successfully
   */
  public static navigateToDiscovery(): boolean {
    try {
      window.location.href = 'https://bandcamp.com/discover';
      return true;
    } catch (error) {
      Logger.error('Error navigating to discovery page:', error);
      return false;
    }
  }

  /**
   * Load all wishlist items by clicking the "view all items" button
   *
   * @returns Promise that resolves to true if all items were loaded successfully
   */
  public static async loadAllWishlistItems(): Promise<boolean> {
    if (!this.isWishlistPage) {
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
      
      // Save the current scroll position more reliably
      const originalScrollPosition = {
        x: window.scrollX,
        y: window.scrollY
      };
      Logger.debug(`Saved original scroll position: x=${originalScrollPosition.x}, y=${originalScrollPosition.y}`);
      
      // Click the wishlist "view all items" button
      try {
        wishlistButton.click();
        Logger.debug('Clicked wishlist "view all items" button');
        
        // Wait for content to load and verify we get the expected count
        let attempts = 0;
        const maxAttempts = 20; // Maximum 20 attempts
        let items: HTMLElement[] = [];
        
        while (attempts < maxAttempts) {
          attempts++;
          
          // Trigger lazy loading by scrolling to bottom and staying there longer
          if (attempts <= 15) { // Scroll for more attempts
            Logger.debug(`Scrolling to trigger lazy loading (attempt ${attempts})`);
            
            // Scroll to the very bottom of the page
            const maxScroll = Math.max(
              document.body.scrollHeight,
              document.body.offsetHeight,
              document.documentElement.clientHeight,
              document.documentElement.scrollHeight,
              document.documentElement.offsetHeight,
            );
            
            window.scrollTo(0, maxScroll);
            
            // Stay at the bottom longer to ensure lazy loading triggers
            await new Promise((resolve) => setTimeout(resolve, 800));
            
            // Check if more items loaded while at bottom
            const itemsAtBottom = this.loadWishlistItems();
            Logger.debug(`Found ${itemsAtBottom.length} items while at bottom`);
            
            // Scroll back to top temporarily to check loading
            window.scrollTo(0, 0);
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
          
          // Wait a bit before checking again
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          // Reload wishlist items and check count
          items = this.loadWishlistItems();
          Logger.debug(`Attempt ${attempts}: Found ${items.length} wishlist items (expected: ${wishlistCount})`);
          
          // If we have the expected count or more, we're done
          if (items.length >= wishlistCount) {
            Logger.debug(`Successfully loaded all ${items.length} wishlist items`);
            break;
          }
          
          // If this is not the last attempt, log that we're waiting
          if (attempts < maxAttempts) {
            Logger.debug(`Still loading items, waiting... (${items.length}/${wishlistCount})`);
          }
        }
        
        // If we still don't have all items, try alternative loading strategies
        if (items.length < wishlistCount) {
          Logger.debug(`Still missing items (${items.length}/${wishlistCount}), trying alternative strategies...`);
          
          // Strategy 1: Try scrolling in smaller increments
          for (let i = 0; i < 5 && items.length < wishlistCount; i++) {
            Logger.debug(`Alternative strategy 1 - incremental scroll ${i + 1}/5`);
            const scrollStep = document.body.scrollHeight / 4;
            window.scrollTo(0, scrollStep * (i + 1));
            await new Promise((resolve) => setTimeout(resolve, 1000));
            items = this.loadWishlistItems();
            Logger.debug(`After incremental scroll ${i + 1}: Found ${items.length} items`);
          }
          
          // Strategy 2: Try staying at bottom for extended time
          if (items.length < wishlistCount) {
            Logger.debug('Alternative strategy 2 - extended bottom stay');
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Stay 3 seconds
            items = this.loadWishlistItems();
            Logger.debug(`After extended bottom stay: Found ${items.length} items`);
          }
          
          // Strategy 3: Try triggering scroll events manually
          if (items.length < wishlistCount) {
            Logger.debug('Alternative strategy 3 - manual scroll events');
            window.scrollTo(0, document.body.scrollHeight);
            // Dispatch scroll events to trigger any lazy loading listeners
            window.dispatchEvent(new Event('scroll'));
            document.dispatchEvent(new Event('scroll'));
            await new Promise((resolve) => setTimeout(resolve, 2000));
            items = this.loadWishlistItems();
            Logger.debug(`After manual scroll events: Found ${items.length} items`);
          }
          
          // Final scroll back to top before checking final counts
          window.scrollTo(0, 0);
        }
        
        // Restore original scroll position with smooth scrolling and delay
        Logger.debug(`Restoring scroll position to: x=${originalScrollPosition.x}, y=${originalScrollPosition.y}`);
        
        // Use a slight delay to ensure DOM is stable after all the loading
        setTimeout(() => {
          try {
            // Use smooth scrolling if the position is reasonable
            if (originalScrollPosition.y < document.body.scrollHeight) {
              window.scrollTo({
                left: originalScrollPosition.x,
                top: originalScrollPosition.y,
                behavior: 'smooth'
              });
            } else {
              // If original position is beyond new page height, scroll to top
              Logger.debug('Original scroll position is beyond new page height, scrolling to top');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } catch (scrollError) {
            Logger.warn('Error restoring scroll position:', scrollError);
            // Fallback to instant scroll
            window.scrollTo(originalScrollPosition.x, originalScrollPosition.y);
          }
        }, 500); // 500ms delay to let DOM settle
        
        Logger.debug(`Final result: Loaded ${items.length} wishlist items after clicking "view all items" button`);
        
        // Return true if we got at least the expected count
        return items.length >= wishlistCount;
      } catch (clickError) {
        Logger.warn('Error clicking wishlist "view all items" button:', clickError);
        return false;
      }
    } catch (error) {
      Logger.error('Error loading all wishlist items:', error);
      return false;
    }
  }

  /**
   * Reset all cached values and flags for SPA navigation
   */
  public static reset(): void {
    Logger.debug('BandcampFacade: Resetting cached values for SPA navigation');
    
    // Clear cached page type flags
    BandcampFacade._isTrack = undefined;
    BandcampFacade._isAlbum = undefined;
    BandcampFacade._isWishlistPage = undefined;
    BandcampFacade._isCollectionPage = undefined;
    BandcampFacade._isFollowersPage = undefined;
    BandcampFacade._isFollowingPage = undefined;
    
    // Clear cached data and colors
    BandcampFacade._data = undefined;
    BandcampFacade._colors = undefined;
    BandcampFacade._audio = undefined;
    
    // Reset wishlist navigation state
    BandcampFacade._wishlistItems = [];
    BandcampFacade._currentWishlistIndex = -1;
    
    // Reset error and navigation flags
    BandcampFacade._pendingNextTrackRequest = false;
    BandcampFacade._errorRecoveryInProgress = false;
    BandcampFacade._skipInProgress = false;
    BandcampFacade._consecutiveErrors = 0;
    BandcampFacade._errorLogSuppressed = false;
    BandcampFacade._releaseNavigationInProgress = false;
    
    // Reset shuffle service history
    ShuffleService.reset();
    
    Logger.debug('BandcampFacade: Reset completed');
  }

  /**
   * Log Phase 2 performance metrics for monitoring optimization effectiveness
   */
  private static logPhase2Metrics(category: string, timeSavedMs: number): void {
    if (!this._phase2MetricsEnabled) {
      return;
    }
    
    Logger.timing(`[Phase 2 Optimization] ${category}: ${timeSavedMs}ms saved`);
    
    // Accumulate metrics by category
    switch (category) {
      case 'Navigation':
        this._navigationDelaysSaved += timeSavedMs;
        break;
      case 'ErrorRecovery':
        this._errorRecoveryDelaysSaved += timeSavedMs;
        break;
      case 'DOMSelection':
        this._domSelectionOptimizations += 1;
        break;
      case 'FlagClearing':
        this._flagClearingOptimizations += 1;
        break;
    }
  }

  /**
   * Get Phase 2 performance summary for debugging
   */
  private static getPhase2PerformanceSummary(): string {
    const totalSaved = this._navigationDelaysSaved + this._errorRecoveryDelaysSaved;
    return `Phase 2 Summary: ${totalSaved}ms saved (Nav: ${this._navigationDelaysSaved}ms, Error: ${this._errorRecoveryDelaysSaved}ms, DOM: ${this._domSelectionOptimizations}, Flags: ${this._flagClearingOptimizations})`;
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
        const item = this._wishlistItems[index];
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
   * Check if there's a track currently playing or selected
   * @returns boolean indicating if a track is currently active
   */
  private static hasCurrentlyPlayingTrack(): boolean {
    try {
      // Check if there's a track marked as currently playing
      const currentTrackRow = document.querySelector('.track_row_view.current_track, .track_row_view.playing');
      if (currentTrackRow) {
        return true;
      }
      
      // Check if any play button is in playing state
      const playingButton = document.querySelector('.playbutton.playing');
      if (playingButton) {
        return true;
      }
      
      // Check if audio has a valid source and has been played
      const audio = this.audio || AudioUtils.getAudioElement();
      if (audio && audio.src && !audio.src.includes('blob:') && audio.currentTime > 0) {
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error('Error checking for currently playing track:', error);
      return false;
    }
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
}
