import { BandcampFacade } from '../facades/bandcamp.facade';
import { MessageService } from '../services/message.service';
import { Logger } from '../utils/logger';

/**
 * Controller for Bandcamp discovery page functionality
 */
export class DiscoveryController {
  /**
   * Initialize the discovery controller
   */
  public static initialize(): void {
    Logger.info('Initializing DiscoveryController');
    
    // Only initialize on discovery pages
    if (!window.location.href.includes('/discover')) {
      return;
    }
    
    this.setupMessageHandlers();
  }
  
  /**
   * Setup message handlers for discovery-related commands
   */
  private static setupMessageHandlers(): void {
    MessageService.addListener('loadMoreDiscoveryItems', async () => {
      const success = await BandcampFacade.loadMoreDiscoveryItems();
      return { success };
    });
    
    MessageService.addListener('getDiscoveryItems', () => {
      const items = BandcampFacade.getDiscoveryItems();
      return { count: items.length, items };
    });
    
    MessageService.addListener('getFeaturedDiscoveryItems', () => {
      const items = BandcampFacade.getFeaturedDiscoveryItems();
      return { count: items.length };
    });
    
    MessageService.addListener('clickDiscoveryItem', (request) => {
      const { index } = request;
      const success = BandcampFacade.clickDiscoveryItem(index);
      return { success };
    });
    
    MessageService.addListener('clickFeaturedDiscoveryItem', (request) => {
      const { index } = request;
      const success = BandcampFacade.clickFeaturedDiscoveryItem(index);
      return { success };
    });
    
    MessageService.addListener('getDiscoveryFilters', () => {
      const filters = BandcampFacade.getDiscoveryFilters();
      return { filters };
    });
    
    MessageService.addListener('applyDiscoveryFilter', (request) => {
      const { filterType, value } = request;
      const success = BandcampFacade.applyDiscoveryFilter(filterType, value);
      return { success };
    });
    
    MessageService.addListener('saveDiscoveryPreferences', (request) => {
      const { name } = request;
      const success = BandcampFacade.saveDiscoveryPreference(name);
      return { success };
    });
    
    MessageService.addListener('loadDiscoveryPreferences', async (request) => {
      const { name } = request;
      const success = await BandcampFacade.loadDiscoveryPreference(name);
      return { success };
    });
    
    MessageService.addListener('getStoredDiscoveryPreferences', () => {
      const preferences = BandcampFacade.getStoredDiscoveryPreferences();
      return { preferences };
    });
    
    MessageService.addListener('deleteDiscoveryPreference', (request) => {
      const { name } = request;
      const success = BandcampFacade.deleteDiscoveryPreference(name);
      return { success };
    });
    
    MessageService.addListener('navigateToDiscovery', () => {
      const success = BandcampFacade.navigateToDiscovery();
      return { success };
    });
  }
}