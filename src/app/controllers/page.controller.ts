import {BandcampFacade} from '../facades/bandcamp.facade';
import {GridLayout} from '../layouts/grid.layout';
import {SpeedController} from './speed.controller';
import {VolumeController} from './volume.controller';
import {CopyInfoController} from './copy-info.controller';
import {AlbumController} from './album.controller';
import {KeyboardController} from './keyboard.controller';
import {WishlistController} from './wishlist.controller';

export interface Controllers {
  speed: SpeedController;
  volume: VolumeController;
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
      volume: null,
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
      this.controllers.volume = new VolumeController();
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

  private createVolumeRow() {
    const container = new GridLayout();

    container.populate({
      leftButton: this.controllers.volume.button.node.getNode(),
      topContent: this.controllers.volume.label.node.getNode(),
      bottomContent: this.controllers.volume.slider.node.getNode(),
      rightButton: this.controllers.copyInfo.button.node.getNode(),
    });

    BandcampFacade.insertBelowPlayer(container.getNode());
  }

  private createRows() {
    this.createSpeedRow();
    this.createVolumeRow();
  }
}
