import {TrackController} from './track.controller';
import {
  BandcampFacade,
  BandcampWishlistState,
} from '../facades/bandcamp.facade';
import {observeElement} from '../utils/observe-element';
import {Logger} from '../utils/logger';
import {NotificationService} from '../services/notification.service';

export class AlbumController {
  private tracks: TrackController[] = [];

  private isLiked: boolean;

  private isCleaningUpTracks = false;

  private button = BandcampFacade.wishlistButton;

  constructor() {
    if (!(BandcampFacade.isLoggedIn && BandcampFacade.isAlbum)) {
      return;
    }

    this.isLiked = BandcampFacade.data?.fan_tralbum_data.is_wishlisted ?? false;

    this.observeButton();
    this.addTracks();
    this.observeTracks();
  }

  /**
   * Observe the wishlist button and update the isLiked property.
   * When the album transitions to wishlisted, remove the album's tracks that
   * were individually wishlisted so the wishlist only keeps the album entry.
   */
  private observeButton() {
    if (!this.button) {
      Logger.debug('No wishlist button found on album page, skipping observer');
      return;
    }

    observeElement(this.button, () => {
      const wasLiked = this.isLiked;
      this.isLiked = this.button.className === BandcampWishlistState.Liked;

      if (!wasLiked && this.isLiked) {
        this.removeIndividuallyWishlistedTracks();
      }
    });
  }

  /**
   * Un-wishlist every track of this album that the fan had wishlisted as an
   * individual release. Runs sequentially to keep the request load gentle.
   */
  private async removeIndividuallyWishlistedTracks(): Promise<void> {
    if (this.isCleaningUpTracks) {
      return;
    }
    this.isCleaningUpTracks = true;

    let removed = 0;

    try {
      for (const track of this.tracks) {
        try {
          if (await track.removeFromWishlistIfPresent()) {
            removed += 1;
          }
        } catch (error) {
          Logger.warn('Could not check/remove individual track wishlist entry:', error);
        }
      }

      if (removed > 0) {
        NotificationService.success(
          `Removed ${removed} individually wishlisted track${removed === 1 ? '' : 's'} of this album`,
        );
      }
    } finally {
      this.isCleaningUpTracks = false;
    }
  }

  private addTracks() {
    BandcampFacade.tracks.forEach((node) => {
      // Preorder albums render unreleased tracks without a track link; those
      // rows can't host the wishlist heart, so skip them instead of letting
      // the constructor throw and abort the whole page initialization.
      if (!node.querySelector('.title a')) {
        Logger.debug('Skipping track row without a track link (likely unreleased preorder track)');
        return;
      }

      try {
        this.tracks.push(new TrackController(node, this));
      } catch (error) {
        Logger.warn('Could not initialize track row controls:', error);
      }
    });
  }

  private observeTracks() {
    const container = BandcampFacade.currentTrackContainer;
    if (!container) {
      Logger.debug('No current track container found on album page, skipping observer');
      return;
    }

    observeElement(container, () => {
      this.tracks.forEach(async (track) => {
        await track.updateVisibility();
      });
    });
  }
}
