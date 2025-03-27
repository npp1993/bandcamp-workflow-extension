import {BandcampFacade} from '../facades/bandcamp.facade';
import {GridLayout} from '../layouts/grid.layout';
import {SpeedController} from './speed.controller';
import {CopyInfoController} from './copy-info.controller';
import {AlbumController} from './album.controller';
import {KeyboardController} from './keyboard.controller';
import {WishlistController} from './wishlist.controller';

export interface Controllers {
  speed: SpeedController;
  copyInfo: CopyInfoController;
  album: AlbumController;
  wishlist?: WishlistController;
}

export class PageController {
  private readonly controllers: Controllers;

  private constructor() {
    // Initialize the controllers with required properties
    this.controllers = {
      speed: null,
      copyInfo: null,
      album: null,
      wishlist: null
    };

    // Initialize wishlist controller for wishlist pages
    if (BandcampFacade.isWishlistPage) {
      this.controllers.wishlist = new WishlistController();
    }

    // If not on a supported page or wishlist page, return early
    if (!BandcampFacade.isPageSupported && !BandcampFacade.isWishlistPage) {
      return;
    }

    // Initialize other controllers only for supported pages
    if (BandcampFacade.isPageSupported) {
      this.controllers.speed = new SpeedController();
      this.controllers.copyInfo = new CopyInfoController();
      this.controllers.album = new AlbumController();
      BandcampFacade.arrange();
      this.createRows();
    }

    // Initialize keyboard controller for both supported pages and wishlist page
    KeyboardController.start(this.controllers);
  }

  public static init(): PageController {
    return new PageController();
  }

  private createSpeedRow() {
    const grid = new GridLayout();
    grid.populate({
      leftButton: this.controllers.speed.resetButton.node.getNode(),
      topContent: this.controllers.speed.labels.node,
      bottomContent: this.controllers.speed.slider.node.getNode(),
      rightButton: this.controllers.speed.stretchButton.node.getNode(),
    });
    BandcampFacade.insertBelowPlayer(grid.getNode());
  }

  private createCopyInfoRow() {
    const container = new GridLayout();
    
    // Create empty span elements for the layout
    const leftButton = document.createElement('span');
    const topContent = document.createElement('span');
    
    // Create a hidden input element that won't be visible
    const bottomContent = document.createElement('input');
    bottomContent.style.display = 'none';
    
    container.populate({
      leftButton,
      topContent,
      bottomContent,
      rightButton: this.controllers.copyInfo.button.node.getNode(),
    });
    
    BandcampFacade.insertBelowPlayer(container.getNode());
  }

  private createRows() {
    this.createSpeedRow();
    // We're no longer creating the copy info row to remove the button from the UI
    // The functionality is still accessible via keyboard shortcut 'C'
  }
}
