/**
 * Background script for Bandcamp Workflow Extension
 * Handles CORS bypass for waveform generation and other background tasks
 */

// Type definitions for background script messaging
interface WaveformRequest {
  contentScriptQuery: 'renderBuffer';
  url: string;
}

interface WaveformResponse {
  data?: number[];
  error?: string;
}

/**
 * Handle waveform audio buffer requests from content scripts
 * Bypasses CORS by fetching audio from Bandcamp CDN directly
 */
chrome.runtime.onMessage.addListener((
  request: WaveformRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: WaveformResponse) => void
): boolean => {
  
  console.log('[Background] Received message:', request.contentScriptQuery);
  
  // Only handle waveform buffer requests
  if (request.contentScriptQuery !== 'renderBuffer') {
    console.log('[Background] Ignoring message with query:', request.contentScriptQuery);
    return false;
  }

  // Validate the request has a URL
  if (!request.url) {
    console.log('[Background] No URL provided in request');
    sendResponse({ error: 'No URL provided in request' });
    return true;
  }

  // Construct full Bandcamp CDN URL
  const fullUrl = `https://t4.bcbits.com/stream/${request.url}`;
  
  console.log('[Background] Fetching audio buffer from:', fullUrl);

  // Fetch the audio buffer from Bandcamp CDN
  fetch(fullUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
    .then(arrayBuffer => {
      // Convert ArrayBuffer to array of numbers for message passing
      const dataArray = Array.from(new Uint8Array(arrayBuffer));
      console.log('[Background] Successfully fetched audio buffer, size:', dataArray.length);
      sendResponse({ data: dataArray });
    })
    .catch(error => {
      console.error('[Background] Error fetching audio buffer:', error);
      sendResponse({ error: error.toString() });
    });

  // Return true to indicate async response
  return true;
});

// Log background script initialization
console.log('[Background] Bandcamp Workflow Extension background script initialized');
