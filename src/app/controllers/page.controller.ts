import {BandcampFacade} from '../facades/bandcamp.facade';
import {GridLayout} from '../layouts/grid.layout';
import {SpeedController} from './speed.controller';
import {CopyInfoController} from './copy-info.controller';
import {AlbumController} from './album.controller';
import {KeyboardController} from './keyboard.controller';
import {WishlistController} from './wishlist.controller';
import {PlaybarController} from './playbar.controller';
import {DownloadHelperController} from './download-helper.controller';
import {WaveformController} from './waveform.controller';
import {KeyboardSidebarController} from './keyboard-sidebar.controller';
import {Logger} from '../utils/logger';

export interface Controllers {
  speed: SpeedController | null;
  copyInfo: CopyInfoController | null;
  album: AlbumController | null;
  wishlist?: WishlistController | null;
  downloadHelper?: DownloadHelperController | null;
  waveform?: WaveformController | null;
  keyboardSidebar?: KeyboardSidebarController | null;
}

/**
 * PageController handles the main page layout and UI components
 */
export class PageController {
  private readonly controllers: Controllers;

  private constructor() {
    // Initialize the controllers with required properties
    this.controllers = {
      speed: null,
      copyInfo: null,
      album: null,
      wishlist: null,
      downloadHelper: null,
      waveform: null,
      keyboardSidebar: null,
    };

    // Initialize download helper controller for download pages
    const isDownloadPage = DownloadHelperController.isDownloadPage();
    
    if (isDownloadPage) {
      this.controllers.downloadHelper = new DownloadHelperController();
    }

    // Initialize wishlist controller for collection-based pages (wishlist and collection), but not download pages
    if (BandcampFacade.isCollectionBasedPage && !isDownloadPage) {
      this.controllers.wishlist = new WishlistController();
    }

    // Initialize keyboard sidebar controller for all pages except download pages
    // This must be done before early return so it works on all page types
    if (!isDownloadPage) {
      this.controllers.keyboardSidebar = KeyboardSidebarController.init(this.controllers);
    }

    // If not on a supported page or collection-based page, or if it's a download page, return early
    if ((!BandcampFacade.isPageSupported && !BandcampFacade.isCollectionBasedPage) || isDownloadPage) {
      return;
    }

    // Initialize other controllers only for supported pages
    if (BandcampFacade.isPageSupported) {
      // First set up the page layout 
      BandcampFacade.arrange();
      
      // Only create speed controller if it doesn't already exist (prevents duplicates)
      // Create it AFTER arrange() so it appears after the moved track table
      if (!this.controllers.speed && !document.querySelector('.bandcamp-workflow-speed-grid')) {
        this.controllers.speed = new SpeedController();
        this.createSpeedRow();
      }
      
      this.controllers.copyInfo = new CopyInfoController();
      this.controllers.album = new AlbumController();
    }

    // Initialize waveform controller for supported page types (track, album, wishlist, collection), but not download pages
    if ((BandcampFacade.isPageSupported || BandcampFacade.isCollectionBasedPage) && !isDownloadPage) {
      WaveformController.initialize();
    }

    // Initialize keyboard controller for both supported pages and collection-based pages, but not download pages
    if (!isDownloadPage) {
      KeyboardController.start(this.controllers);
    }

    // Initialize the advanced mouse playbar controller
    // This works on both regular pages and collection-based pages
    PlaybarController.start();
  }

  public static init(): PageController {
    return new PageController();
  }

  /**
   * Clean up existing extension elements to prevent duplicates
   * This is primarily needed for SPA navigation on collection-based pages
   * Note: Sidebars are global UI components and persist across navigation
   */
  public cleanup(): void {
    // Remove existing extension elements (excluding global sidebars)
    const selectors = [
      '.bandcamp-workflow-speed-grid', // Speed controller grids
      '.bandcamp-waveform-container', // Waveform containers
      '.bandcamp-waveform-loading', // Waveform loading indicators
      '.bandcamp-waveform-error', // Waveform error indicators
      '.bandcamp-workflow-download-all' // Download helper buttons
    ];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        Logger.debug(`Cleaning up ${elements.length} extension element(s): ${selector}`);
        elements.forEach(element => element.remove());
      }
    });

    // Clean up controller-specific resources
    if (this.controllers.wishlist) {
      this.controllers.wishlist.cleanup();
    }
    
    // Clean up waveform controller
    WaveformController.cleanup();
    
    Logger.debug('PageController cleanup completed');
  }

  private createSpeedRow(): void {
    if (!this.controllers.speed) {
      return;
    }
    
    const grid = new GridLayout();
    grid.populate({
      leftButton: this.controllers.speed.resetButton.node.getNode(),
      topContent: this.controllers.speed.labels.node,
      bottomContent: this.controllers.speed.slider.node.getNode(),
      rightButton: this.controllers.speed.stretchButton.node.getNode(),
    });
    
    // Add a specific class for easier cleanup
    const gridNode = grid.getNode();
    gridNode.classList.add('bandcamp-workflow-speed-grid');
    
    // Insert below player (the arrangement will happen after this)
    BandcampFacade.insertBelowPlayer(gridNode);
  }
}
