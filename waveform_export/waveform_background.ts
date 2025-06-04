// Minimal background script for Bandcamp waveform extraction (TypeScript)
// Handles CORS by fetching audio from Bandcamp CDN and returning it to the content script

chrome.runtime.onMessage.addListener((request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: { data?: number[]; error?: string }) => void) => {
  if (request.contentScriptQuery !== "renderBuffer") return false;

  const url = `https://t4.bcbits.com/stream/${request.url}`;
  fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => {
      // Convert ArrayBuffer to a plain object for messaging
      sendResponse({ data: Array.from(new Uint8Array(arrayBuffer)) });
    })
    .catch(error => {
      sendResponse({ error: error.toString() });
    });
  // Indicate async response
  return true;
});
