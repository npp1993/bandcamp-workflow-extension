import {DownloadHelperService} from '../services/download-helper.service';
import {Logger} from '../utils/logger';

/**
 * Controller for the Bandcamp download helper functionality
 * Adds a cURL download script generator button on purchased music download pages
 */
export class DownloadHelperController {
  private downloadHelperService: DownloadHelperService;

  /**
   * Initialize the download helper controller
   */
  constructor() {
    this.downloadHelperService = new DownloadHelperService();
    this.downloadHelperService.init();
  }

  /**
   * Check if the current page is a download page (contains download items)
   */
  public static isDownloadPage(): boolean {
    // Check for the main download container that both page types have
    const hasDownloadContainer = !!document.querySelector('.download-item-container');
    
    if (!hasDownloadContainer) {
      return false;
    }
    
    // Additional checks to confirm it's actually a download page
    const hasBulkItems = !!document.querySelector('li.download_list_item');
    const hasItemButton = !!document.querySelector('.item-button'); // Single page has this
    const hasDownloadLink = !!document.querySelector('a[href*="/download/"]'); // Fallback
    
    Logger.debug(`Download page detection: container=${hasDownloadContainer}, bulk=${hasBulkItems}, button=${hasItemButton}, link=${hasDownloadLink}`);
    
    // If we have the container and any download indicators, it's a download page
    return hasBulkItems || hasItemButton || hasDownloadLink;
  }
}
