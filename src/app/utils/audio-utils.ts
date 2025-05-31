/**
 * Utility functions for working with audio elements
 */
export class AudioUtils {
  /**
   * Get the main audio element from the page
   */
  public static getAudioElement(): HTMLAudioElement | null {
    return document.querySelector('audio');
  }

  /**
   * Get audio element specifically for wishlist pages
   */
  public static getWishlistAudioElement(): HTMLAudioElement | null {
    return document.querySelector('.carousel-player-inner audio') || 
           document.querySelector('audio');
  }

  /**
   * Get progress bar element for UI updates
   */
  public static getProgressBar(): Element | null {
    return document.querySelector('.progress, .progbar_empty, .progbar_fill');
  }

  /**
   * Get wishlist-specific progress bar element
   */
  public static getWishlistProgressBar(): Element | null {
    return document.querySelector('.carousel-player-inner .progress-bar') ||
           document.querySelector('.carousel-player-inner .progress');
  }

  /**
   * Dispatch timeupdate event to force UI refresh
   */
  public static forceUIUpdate(audioElement: HTMLAudioElement): void {
    const event = new Event('timeupdate');
    audioElement.dispatchEvent(event);
  }

  /**
   * Check if audio element has a valid source
   */
  public static hasValidSource(audioElement: HTMLAudioElement): boolean {
    return !!(audioElement.src && 
             !audioElement.src.includes('blob:') && 
             !audioElement.src.includes('track_id=&'));
  }
}
