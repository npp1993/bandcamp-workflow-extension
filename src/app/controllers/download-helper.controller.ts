import {DownloadHelperService} from '../services/download-helper.service';

/**
 * Controller for download helper functionality
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
    return !!document.querySelector('.download-item-container');
  }
}
