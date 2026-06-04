/**
 * Play/pause transport, extracted from BandcampFacade.
 *
 * togglePlayPause handles play/pause across album, track, wishlist and collection
 * pages (delegating into the wishlist playback engine for collection-based pages).
 * Its debounce flag lives here; everything else is read from BandcampFacade.
 * (The trivial seek/speed wrappers remain thin BandcampFacade methods over SeekUtils.)
 */
import {BandcampFacade} from '../bandcamp.facade';
import {Logger} from '../../utils/logger';
import {AudioUtils} from '../../utils/audio-utils';
import {ErrorHandler} from '../../utils/error-handler';

export class Transport {
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
      Logger.debug(`Page type - isAlbum: ${BandcampFacade.isAlbum}, isTrack: ${BandcampFacade.isTrack}, isWishlistPage: ${BandcampFacade.isWishlistPage}`);
      Logger.debug(`Current URL: ${window.location.href}`);
      
      // Log audio element state
      const audio = BandcampFacade.audio || AudioUtils.getAudioElement();
      if (audio) {
        Logger.debug(`Audio element found - paused: ${audio.paused}, currentTime: ${audio.currentTime}, src: ${audio.src}`);
      } else {
        Logger.debug('No audio element found');
      }
      
      // Log current track state
      const hasCurrentTrack = BandcampFacade.hasCurrentlyPlayingTrack();
      Logger.debug(`Has currently playing track: ${hasCurrentTrack}`);
      
      // Log track table and current track info
      const trackTable = BandcampFacade.trackTable;
      if (trackTable) {
        const tracks = BandcampFacade.tracks;
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
      const loggedPlayButton = BandcampFacade.getPlay();
      if (loggedPlayButton) {
        Logger.debug(`Play button found - classes: ${loggedPlayButton.className}, onclick: ${loggedPlayButton.getAttribute('onclick')}`);
      } else {
        Logger.debug('No play button found');
      }

      // Special handling for collection-based pages (wishlist and collection)
      if (BandcampFacade.isCollectionBasedPage) {
        const pageType = BandcampFacade.isWishlistPage ? 'WISHLIST' : 'COLLECTION';
        Logger.debug(`=== ${pageType} PAGE HANDLING ===`);
        
        // Check if we need to start playback for the first time (no track selected yet)
        if (BandcampFacade._wishlistItems.length === 0) {
          Logger.debug(`Loading ${pageType.toLowerCase()} items for first-time playback`);
          BandcampFacade.loadWishlistItems();
        }
        
        const collectionAudio = AudioUtils.getWishlistAudioElement();
        
        // Check if no track is currently loaded/playing (audio has no src or is at beginning)
        const needsFirstTimePlayback = collectionAudio && 
          (!collectionAudio.src || collectionAudio.src === '' || 
           (collectionAudio.currentTime === 0 && collectionAudio.paused && BandcampFacade._currentWishlistIndex < 0));
        
        if (needsFirstTimePlayback && BandcampFacade._wishlistItems.length > 0) {
          Logger.debug(`No track currently loaded on ${pageType.toLowerCase()} page, starting from first track`);
          // Clear the flag before starting a new track to avoid lockout
          this._playPauseInProgress = false;
          BandcampFacade.startWishlistPlayback();
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
      const playButton = BandcampFacade.getPlay();
      if (playButton) {
        // Check if we're on album page and no track is currently playing
        if (BandcampFacade.isAlbum) {
          Logger.debug('=== ALBUM PAGE ANALYSIS ===');
          
          // If audio is paused and there's no current track, start from the first track
          if (audio && audio.paused && !BandcampFacade.hasCurrentlyPlayingTrack()) {
            Logger.debug('No track currently playing on album page, calling playFirstTrack()');
            BandcampFacade.playFirstTrack();
            // Clear the flag after starting first track
            setTimeout(() => {
              this._playPauseInProgress = false;
            }, 300);
            Logger.debug('=== PLAY BUTTON ANALYSIS END (playFirstTrack called) ===');
            return;
          } else {
            Logger.debug(`Audio state - paused: ${audio?.paused}, hasCurrentTrack: ${BandcampFacade.hasCurrentlyPlayingTrack()}`);
          }
        }
        
        Logger.debug('Clicking play button to toggle play/pause');
        
        // Log what will happen after clicking the play button
        setTimeout(() => {
          const audioAfterClick = BandcampFacade.audio || AudioUtils.getAudioElement();
          if (audioAfterClick) {
            Logger.debug(`AFTER PLAY BUTTON CLICK - Audio paused: ${audioAfterClick.paused}, currentTime: ${audioAfterClick.currentTime}, src: ${audioAfterClick.src}`);
          }
          
          // Check which track is now current
          const currentTrackRowAfter = document.querySelector('.track_row_view.current_track');
          if (currentTrackRowAfter && trackTable) {
            const trackIndexAfter = Array.from(BandcampFacade.tracks).indexOf(currentTrackRowAfter as HTMLTableRowElement);
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
        const audio = BandcampFacade.audio || AudioUtils.getAudioElement();
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
}
