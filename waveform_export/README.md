# Bandcamp Waveform Extraction Logic

This directory contains a minimal, self-contained version of the Bandcamp waveform extraction and rendering logic, suitable for integration into another Chrome extension.

## Files
- `waveform_content.ts`: TypeScript content script logic for extracting the audio stream, requesting the audio buffer, and rendering the waveform on a canvas.
- `waveform_background.ts`: TypeScript background script logic for fetching the audio buffer from Bandcamp's CDN, bypassing CORS restrictions.
- `README.md`: This file, with integration instructions and important notes.

## Integration Instructions

### 1. Add the Files
Copy `waveform_content.ts` and `waveform_background.ts` into your extension's source directory.

### 2. Update Your Manifest
- Register the compiled JavaScript from `waveform_content.ts` as a content script on Bandcamp pages.
- Register the compiled JavaScript from `waveform_background.ts` as your background script.
- Ensure you have the following permissions in your `manifest.json`:
  - `"background"`
  - `"activeTab"`
  - `"scripting"` (if using Manifest V3)
  - `"host_permissions": ["https://t4.bcbits.com/*"]`

### 3. Content Script Usage
- The content script finds the `<audio>` element, extracts the stream ID, and sends a message to the background script to fetch the audio buffer.
- Once the buffer is received, it decodes and renders the waveform on a canvas.

### 4. CORS Bypass Explanation
**Bandcamp's audio streams are protected by CORS.**
- The content script cannot fetch the audio data directly due to browser security restrictions.
- Instead, it sends a message to the background script, which is allowed (by extension permissions) to fetch the audio data from Bandcamp's CDN (`https://t4.bcbits.com/stream/`).
- The background script fetches the audio as an ArrayBuffer and returns it to the content script, which can then decode and process it.

### 5. Example Usage
See `waveform_content.ts` for a minimal example of how to:
- Access the audio element
- Request the audio buffer
- Render the waveform

---
**This logic is designed to be portable and easy to integrate into any Chrome extension that needs to visualize Bandcamp audio waveforms.**
