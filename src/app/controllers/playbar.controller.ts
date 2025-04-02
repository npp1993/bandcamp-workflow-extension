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
    // For album and track pages
    if (BandcampFacade.isAlbum || BandcampFacade.isTrack) {
      console.log('Setting up playbar handlers for album/track page');
      
      // The main progress bar
      const progressBar = document.querySelector('.progbar_empty, .progbar, .progress');
      if (progressBar) {
        console.log('Found album/track page progress bar');
        progressBar.addEventListener('click', this.handlePlaybarClick);
      }
    }
    
    // Add support for wishlist page playbar
    if (BandcampFacade.isWishlistPage) {
      console.log('Setting up playbar handlers for wishlist page');
      
      // Look for the carousel player progress bar
      const wishlistProgressBar = document.querySelector('.carousel-player-inner .progress-bar, .carousel-player-inner .progress');
      if (wishlistProgressBar) {
        console.log('Found wishlist page progress bar');
        wishlistProgressBar.addEventListener('click', this.handlePlaybarClick);
      }
      
      // Add mutation observer to handle dynamic player elements
      this.setupWishlistPlayerObserver();
    }
  }

  /**
   * Setup a mutation observer to watch for dynamically added wishlist player elements
   */
  private static setupWishlistPlayerObserver(): void {
    // Create a mutation observer to watch for changes in the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if a new player was added
          const addedProgressBar = document.querySelector('.carousel-player-inner .progress-bar:not(.click-attached), .carousel-player-inner .progress:not(.click-attached)');
          if (addedProgressBar) {
            console.log('Found dynamically added wishlist player progress bar');
            addedProgressBar.addEventListener('click', this.handlePlaybarClick);
            addedProgressBar.classList.add('click-attached');  // Mark it as processed
          }
        }
      });
    });

    // Start observing the document for DOM changes
    observer.observe(document.body, { childList: true, subtree: true });
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
    
    // Get the audio element
    let audio: HTMLAudioElement;
    
    // Handle different page types
    if (BandcampFacade.isWishlistPage) {
      // Find the audio element in the carousel player
      audio = document.querySelector('.carousel-player-inner audio') || document.querySelector('audio');
    } else {
      // Standard album/track page
      audio = document.querySelector('audio');
    }
    
    // Set the current time if audio is available and has a valid duration
    if (audio && !isNaN(audio.duration)) {
      const newTime = clampedRatio * audio.duration;
      audio.currentTime = newTime;
      
      // Force UI update
      const event = new Event('timeupdate');
      audio.dispatchEvent(event);
      
      console.log(`Set audio position to ${newTime.toFixed(1)}s (${(clampedRatio * 100).toFixed(0)}%)`);
    } else {
      console.warn('Could not set playback position - no valid audio element found');
    }
  }
}