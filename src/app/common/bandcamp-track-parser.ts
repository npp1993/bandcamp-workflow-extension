import {BandcampData} from '../facades/bandcamp.facade';

interface MetaContent {
  item_id: number;
}

interface Crumbs {
  collect_item_cb: string;
  uncollect_item_cb: string;
}

export class BandcampTrackParser {
  public is_wishlisted: boolean;

  public fan_id: number;

  public band_id: number;

  public item_id: number;

  public item_type: string;

  public data_referrer_token: string;

  public collect: string;

  public uncollect: string;

  private collectCrumb: string;

  private uncollectCrumb: string;

  private pageData: HTMLDivElement;

  private string: string;

  private json: BandcampData;

  private meta: HTMLMetaElement;

  private metaContent: MetaContent;

  private script: HTMLScriptElement;

  private crumbs: HTMLMetaElement;

  private crumbsData: Crumbs;

  private document: Document;

  public constructor(doc: Document) {
    this.document = doc;

    this.pageData = this.document.querySelector('#pagedata')!;
    if (!this.pageData) {
      throw new Error('Page data element not found');
    }
    this.string = this.pageData.dataset.blob!;
    if (!this.string) {
      throw new Error('Page data blob not found');
    }
    this.json = JSON.parse(this.string);

    this.meta = this.document.querySelector('meta[name="bc-page-properties"]')!;
    if (!this.meta || !this.meta.content) {
      throw new Error('Page properties meta tag not found');
    }
    this.metaContent = JSON.parse(this.meta.content);

    this.script = this.document.querySelector('script[data-referrer-token]')!;
    if (!this.script) {
      throw new Error('Referrer token script not found');
    }

    this.crumbs = this.document.querySelector('#js-crumbs-data')!;
    if (!this.crumbs || !this.crumbs.dataset.crumbs) {
      throw new Error('Crumbs data element not found');
    }
    this.crumbsData = JSON.parse(this.crumbs.dataset.crumbs);

    this.is_wishlisted = this.json.fan_tralbum_data.is_wishlisted;
    this.fan_id = this.json.fan_tralbum_data.fan_id;
    this.band_id = this.json.fan_tralbum_data.band_id;
    this.item_id = this.metaContent.item_id;
    this.item_type = 'track';
    if (!this.script.dataset.referrerToken) {
      throw new Error('Referrer token not found');
    }
    this.data_referrer_token = JSON.parse(this.script.dataset.referrerToken);
    this.collectCrumb = this.crumbsData.collect_item_cb;
    this.uncollectCrumb = this.crumbsData.uncollect_item_cb;

    const tokenScript = document.querySelector('script[data-referrer-token]')!;
    if (!tokenScript) {
      throw new Error('Token script element not found');
    }
    const tokenAttr = tokenScript.getAttribute('data-referrer-token')!;
    if (!tokenAttr) {
      throw new Error('Token attribute not found');
    }
    const token = JSON.parse(tokenAttr);

    this.collect = new URLSearchParams({
      fan_id: this.fan_id.toString(),
      item_id: this.item_id.toString(),
      item_type: this.item_type.toString(),
      band_id: this.band_id.toString(),
      // data_referrer_token: this.data_referrer_token.toString(),
      ref_token: token,
      crumb: this.collectCrumb.toString(),
    }).toString();

    this.uncollect = new URLSearchParams({
      fan_id: this.fan_id.toString(),
      band_id: this.band_id.toString(),
      item_id: this.item_id.toString(),
      item_type: this.item_type.toString(),
      // data_referrer_token: this.data_referrer_token.toString(),
      ref_token: token,
      crumb: this.uncollectCrumb.toString(),
    }).toString();
  }
}
