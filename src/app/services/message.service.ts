/// <reference types="chrome" />

/**
 * Service for handling messages between content scripts and background scripts
 */
export class MessageService {
  private static listeners: Map<string, (request: any) => any> = new Map();

  /**
   * Add a listener for a specific message type
   * @param type The message type to listen for
   * @param callback The callback to execute when message is received
   */
  public static addListener(type: string, callback: (request: any) => any): void {
    this.listeners.set(type, callback);
    
    // If this is the first listener, setup the global message listener
    if (this.listeners.size === 1) {
      this.setupGlobalListener();
    }
  }

  /**
   * Remove a listener for a specific message type
   * @param type The message type to remove listener for
   */
  public static removeListener(type: string): void {
    this.listeners.delete(type);
  }

  /**
   * Setup the global message listener to handle all incoming messages
   */
  private static setupGlobalListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        return this.handleMessage(message, sender, sendResponse);
      });
    }
  }

  /**
   * Handle an incoming message
   * @param message The message object
   * @param sender The sender information
   * @param sendResponse The sendResponse callback
   * @returns Whether the sendResponse will be called asynchronously
   */
  private static handleMessage(message: any, sender: any, sendResponse: (response: any) => void): boolean {
    // Ignore messages without a type
    if (!message || !message.type) {
      return false;
    }

    const { type, data } = message;
    
    // Check if we have a listener for this message type
    const listener = this.listeners.get(type);
    if (!listener) {
      return false;
    }

    try {
      // Call the listener with the message data
      const result = listener(data);
      
      // Check if the result is a Promise
      if (result instanceof Promise) {
        // Handle async response
        result
          .then(response => {
            sendResponse({ success: true, data: response });
          })
          .catch(error => {
            console.error(`Error handling message ${type}:`, error);
            sendResponse({ success: false, error: error.message });
          });
        
        // Return true to indicate that sendResponse will be called asynchronously
        return true;
      } else {
        // Synchronous response
        sendResponse({ success: true, data: result });
        return false;
      }
    } catch (error) {
      console.error(`Error handling message ${type}:`, error);
      sendResponse({ success: false, error: error.message });
      return false;
    }
  }

  /**
   * Send a message and get a response
   * @param type The message type
   * @param data The message data
   * @returns A promise that resolves with the response
   */
  public static sendMessage(type: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type, data }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success === false) {
            reject(response.error || 'Unknown error');
          } else {
            resolve(response?.data);
          }
        });
      } else {
        reject(new Error('Chrome runtime not available'));
      }
    });
  }
}