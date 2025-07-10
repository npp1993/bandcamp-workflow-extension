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
  // Only handle waveform buffer requests
  if (request.contentScriptQuery !== 'renderBuffer') {
    return false;
  }

  // Validate the request has a URL
  if (!request.url) {
    sendResponse({error: 'No URL provided in request'});
    return true;
  }

  // Use the complete URL as provided (it should already include auth parameters)
  const audioUrl = request.url;

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
      sendResponse({data: dataArray});
    })
    .catch((error) => {
      Logger.error('Error fetching audio buffer:', error);
      sendResponse({error: error.toString()});
    });

  // Return true to indicate async response
  return true;
});
