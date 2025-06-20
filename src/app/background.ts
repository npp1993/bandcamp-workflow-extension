/**
 * Background script for Bandcamp Workflow Extension
 * Handles CORS bypass for waveform generation and other background tasks
 */

// Type definitions for background script messaging
import {Logger} from './utils/logger';

interface WaveformRequest {
  contentScriptQuery: 'renderBuffer';
  url: string; // Complete audio URL with authentication parameters
}

interface WaveformResponse {
  data?: number[];
  error?: string;
}

/**
 * Handle waveform audio buffer requests from content scripts
 * Bypasses CORS by fetching audio directly using the complete authenticated URL
 */
chrome.runtime.onMessage.addListener((
  request: WaveformRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: WaveformResponse) => void,
): boolean => {
  Logger.info('[Background] Received message:', request.contentScriptQuery);
  
  // Only handle waveform buffer requests
  if (request.contentScriptQuery !== 'renderBuffer') {
    Logger.info('[Background] Ignoring message with query:', request.contentScriptQuery);
    return false;
  }

  // Validate the request has a URL
  if (!request.url) {
    Logger.info('[Background] No URL provided in request');
    sendResponse({error: 'No URL provided in request'});
    return true;
  }

  // Use the complete URL as provided (it should already include auth parameters)
  const audioUrl = request.url;
  
  Logger.info('[Background] Fetching audio buffer from:', audioUrl);
  Logger.info('[Background] URL includes auth params:', audioUrl.includes('?'));

  // Fetch the audio buffer from the provided URL
  fetch(audioUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => {
      // Convert ArrayBuffer to array of numbers for message passing
      const dataArray = Array.from(new Uint8Array(arrayBuffer));
      Logger.info('[Background] Successfully fetched audio buffer, size:', dataArray.length);
      sendResponse({data: dataArray});
    })
    .catch((error) => {
      Logger.error('[Background] Error fetching audio buffer:', error);
      sendResponse({error: error.toString()});
    });

  // Return true to indicate async response
  return true;
});

// Log background script initialization
Logger.info('[Background] Bandcamp Workflow Extension background script initialized');
