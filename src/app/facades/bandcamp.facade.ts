// @ts-nocheck - Temporarily disable strict null checks for this large facade file
import {SEEK_STEP, SPEED_GRID_CLASS, TIMEOUT, WAVEFORM_ELEMENT_SELECTOR} from '../constants';
import {Logger} from '../utils/logger';
import {PageDetection} from './bandcamp/page-detection';
import {ReleaseNavigation} from './bandcamp/release-navigation';
import {WishlistPlayback} from './bandcamp/wishlist-playback';
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
    return PageDetection.isTrack;
  }

  public static get isAlbum(): boolean {
    return PageDetection.isAlbum;
  }

  public static get isWishlistPage(): boolean {
    return PageDetection.isWishlistPage;
  }

  public static get isCollectionPage(): boolean {
    return PageDetection.isCollectionPage;
  }

  public static get isFollowersPage(): boolean {
    return PageDetection.isFollowersPage;
  }

  public static get isFollowingPage(): boolean {
    return PageDetection.isFollowingPage;
  }

  /**
   * Check if current page supports track transport controls (wishlist or collection)
   */
  public static get isCollectionBasedPage(): boolean {
    return PageDetection.isCollectionBasedPage;
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
    return PageDetection.isPageSupported;
  }

  public static get isLoggedIn(): boolean {
    return PageDetection.isLoggedIn;
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

  public static navigateToTrack(trackIndex: number): void {
    ReleaseNavigation.navigateToTrack(trackIndex);
  }

  public static playNextReleaseTrack(): void {
    ReleaseNavigation.playNextReleaseTrack();
  }

  public static playPreviousReleaseTrack(): void {
    ReleaseNavigation.playPreviousReleaseTrack();
  }

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
    const waveformContainer = document.querySelector(WAVEFORM_ELEMENT_SELECTOR);
    
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
    const speedController = document.querySelector(`.${SPEED_GRID_CLASS}`);
    
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

  public static loadWishlistItems(): HTMLElement[] {
    return WishlistPlayback.loadWishlistItems();
  }

  public static playWishlistTrack(index: number): void {
    WishlistPlayback.playWishlistTrack(index);
  }

  public static playNextWishlistTrack(): void {
    WishlistPlayback.playNextWishlistTrack();
  }

  public static async playPreviousWishlistTrack(): Promise<void> {
    return WishlistPlayback.playPreviousWishlistTrack();
  }

  public static startWishlistPlayback(): void {
    WishlistPlayback.startWishlistPlayback();
  }

  public static isPlayingWishlistTrack(): boolean {
    return WishlistPlayback.isPlayingWishlistTrack();
  }

  public static setupWishlistContinuousPlayback(): void {
    WishlistPlayback.setupWishlistContinuousPlayback();
  }

  public static findPlayButton(item: HTMLElement): HTMLElement | null {
    return WishlistPlayback.findPlayButton(item);
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
    PageDetection.reset();
    
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
