import { BandcampFacade } from '../facades/bandcamp.facade';

/**
 * PlaybarController class for handling playbar interactions
 * Allows clicking on the playbar to set the position of the playhead
 */
export class PlaybarController {
  private static initialized = false;

  /**
   * Start the playbar controller
   */
  public static start(): void {
    if (this.initialized) {
      return;
    }

    console.log('Starting PlaybarController');
    this.attachPlaybarClickHandlers();
    this.initialized = true;
  }

  /**
   * Find and attach click handlers to playbar elements on album/track pages
   */
  private static attachPlaybarClickHandlers(): void {
    // For album and track pages only (wishlist already has this functionality)
    if (BandcampFacade.isAlbum || BandcampFacade.isTrack) {
      console.log('Setting up playbar handlers for album/track page');
      
      // The main progress bar
      const progressBar = document.querySelector('.progbar_empty, .progbar, .progress');
      if (progressBar) {
        console.log('Found album/track page progress bar');
        progressBar.addEventListener('click', this.handlePlaybarClick);
      }
    }
  }

  /**
   * Handle a click on the playbar
   * @param e Click event on playbar
   */
  private static handlePlaybarClick = (e: MouseEvent): void => {
    // Stop event propagation to prevent other handlers from firing
    e.stopPropagation();
    
    // Get the position information
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    // Calculate the click position relative to the playbar width
    const clickX = e.clientX - rect.left;
    const totalWidth = rect.width;
    const ratio = clickX / totalWidth;
    
    // Ensure ratio is between 0 and 1
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    
    // Get the audio element and set its current time
    const audio = document.querySelector('audio');
    if (audio && !isNaN(audio.duration)) {
      const newTime = clampedRatio * audio.duration;
      audio.currentTime = newTime;
      
      // Force UI update
      const event = new Event('timeupdate');
      audio.dispatchEvent(event);
    }
  }
}