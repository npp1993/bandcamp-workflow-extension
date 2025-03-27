import {BandcampFacade} from '../facades/bandcamp.facade';
import {GridLayout} from '../layouts/grid.layout';
import {SpeedController} from './speed.controller';
import {CopyInfoController} from './copy-info.controller';
import {AlbumController} from './album.controller';
import {KeyboardController} from './keyboard.controller';
import {WishlistController} from './wishlist.controller';
import {PlaybarController} from './playbar.controller';

export interface Controllers {
  speed: SpeedController;
  copyInfo: CopyInfoController;
  album: AlbumController;
  wishlist?: WishlistController;
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
      this.createSpeedRow();
    }

    // Initialize keyboard controller for both supported pages and wishlist page
    KeyboardController.start(this.controllers);

    // Initialize the advanced mouse playbar controller
    // This works on both regular pages and wishlist pages
    PlaybarController.start();
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
}
