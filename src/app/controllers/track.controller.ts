import {TrackView} from '../views/track.view';
import {BandcampTrackParser} from '../common/bandcamp-track-parser';
import {KeyboardController} from './keyboard.controller';
import {AlbumController} from './album.controller';
import {WishlistService} from '../services/wishlist.service';

export class TrackController {
  public view: TrackView;

  private album: AlbumController;

  private anchor: HTMLAnchorElement;

  private href: string;

  private meta: BandcampTrackParser;

  private isLoading = false;

  private isReady = false;

  private isError = false;

  private isWishlisted: boolean;

  constructor(node: HTMLTableRowElement, album: AlbumController) {
    this.view = new TrackView(node);
    this.album = album;

    const anchorElement = this.view.node.querySelector('.title a');
    if (!anchorElement) {
      throw new Error('Track anchor element not found');
    }
    this.anchor = anchorElement as HTMLAnchorElement;

    this.href = this.anchor.href;

    this.setHoverEvents();
    this.setClickEvents();
  }

  public async updateVisibility(): Promise<void> {
    if (this.view.isPlaying) {
      this.view.show();
    } else {
      this.view.hide();
    }

    if (!this.isReady && this.view.isPlaying) {
      await this.load();
    }

    if (this.view.isPlaying) {
      KeyboardController.setCurrentTrack(this);
    }
  }

  public click(): void {
    this.view.container.click();
  }

  private async toggleWishlist(): Promise<boolean> {
    // Handle fetch function selection like the original code
    // @ts-expect-error TS2693
    const fetchFunction = typeof content !== 'undefined' ? content?.fetch : fetch;
    
    return WishlistService.toggleWishlist({
      isCurrentlyWishlisted: this.isWishlisted,
      collectPayload: this.meta.collect,
      uncollectPayload: this.meta.uncollect,
      fetchFunction,
    });
  }

  private render(): void {
    if (this.isLoading) {
      this.view.renderLoading();
    } else if (this.isWishlisted) {
      this.view.renderLike();
    } else {
      this.view.renderDislike();
    }

    if (this.isError) {
      this.view.renderError();
      this.isError = false;
    }
  }

  private async load() {
    if (!this.isLoading && !this.isReady) {
      this.isLoading = true;
      this.render();

      await this.loadMeta();
      this.validateMeta();

      this.isLoading = false;
      this.isReady = true;
      this.render();
    }
  }

  private setHoverEvents() {
    this.view.node.addEventListener('mouseenter', async () => {
      this.view.render(true);
      await this.load();
    });

    this.view.node.addEventListener('mouseleave', () => {
      this.view.render();
    });
  }

  private setClickEvents() {
    this.view.container.onclick = async () => {
      if (!this.isReady) {
        return;
      }

      this.isLoading = true;
      this.render();

      const hasToggled = await this.toggleWishlist();

      if (hasToggled) {
        this.isWishlisted = !this.isWishlisted;
      } else {
        this.isError = true;
      }

      this.isLoading = false;
      this.render();
    };
  }

  private async loadMeta() {
    if (!this.href) {
      throw new Error('No href found');
    }

    const response = await fetch(this.href);
    const html = await response.text();
    const parser = new DOMParser();
    const document = parser.parseFromString(html, 'text/html');

    this.meta = new BandcampTrackParser(document);
    this.isWishlisted = this.meta.is_wishlisted;
  }

  private validateMeta() {
    if (
      typeof this.meta.is_wishlisted !== 'undefined'
      && typeof this.meta.fan_id !== 'undefined'
      && typeof this.meta.band_id !== 'undefined'
      && typeof this.meta.item_id !== 'undefined'
      && typeof this.meta.item_type !== 'undefined'
      && typeof this.meta.data_referrer_token !== 'undefined'
      && typeof this.meta.collect !== 'undefined'
      && typeof this.meta.uncollect !== 'undefined'
    ) {
      return;
    }

    throw new Error('Meta data is not valid');
  }
}
