# Chrome Web Store Submission Justifications

This document contains the required justifications for Chrome Web Store submission.

## Permission Justifications

### 1. activeTab Permission

**Justification:**
```
The activeTab permission is required to interact with the currently active Bandcamp page. This allows the extension to:
- Read page content to identify track/album information for keyboard shortcuts
- Inject enhanced UI controls for playback speed adjustment and waveform visualization
- Provide seamless navigation between tracks and albums
- Enable add-to-cart functionality through keyboard shortcuts
The extension only accesses the active tab when the user is on a Bandcamp domain and does not access any other tabs or browse user's browsing history.
```

### 2. Host Permissions (*.bandcamp.com, t4.bcbits.com)

**Justification:**
```
Host permissions for *.bandcamp.com and t4.bcbits.com are essential for core functionality:
- *.bandcamp.com: Required to access all Bandcamp pages (artist pages, album pages, wishlist, discovery) to provide keyboard shortcuts, UI enhancements, and navigation features
- t4.bcbits.com: Required to access Bandcamp's audio stream servers for waveform generation and audio analysis features
These permissions are limited to Bandcamp-related domains only. No other websites are accessed. All data processing occurs locally within the user's browser.
```

### 3. Storage Permission

**Justification:**
```
The storage permission is used exclusively for saving user preferences locally:
- Discovery page filter settings that users choose to save for convenience
- Temporary waveform cache data (expires after 15 minutes) to improve performance
- No personal data, browsing history, or sensitive information is stored
- All stored data remains local to the user's browser and is never transmitted to external servers
- Users can clear this data at any time through browser settings or by uninstalling the extension
```

### 4. Remote Code Use

**Justification:**
```
This extension does NOT use remote code. All functionality is self-contained within the extension package:
- All JavaScript code is bundled and minified at build time from local TypeScript source files
- All dependencies (speed-to-percentage, speed-to-semitones) are bundled into the extension package
- No external scripts are loaded or executed
- No eval(), new Function(), or dynamic import() calls are used
- The extension only fetches HTML content and audio data from Bandcamp (not executable code)
- All code execution happens from the packaged extension files only
```

## Store Listing Information

### Single Purpose Description
"Enhances Bandcamp browsing with keyboard shortcuts and audio visualization features"

### Detailed Description for Store
```
This extension adds Vim-style keyboard shortcuts and enhanced features to Bandcamp, making music browsing faster and more efficient. Features include:

• Keyboard shortcuts for play/pause, track navigation, and quick purchases
• Visual waveform generation for audio tracks
• Bulk wishlist management and cart operations
• Playback speed controls with vinyl and stretched audio modes
• Enhanced wishlist streaming capabilities

All processing occurs locally in your browser. No data is collected or transmitted to external servers.
```

### Category
Productivity

### Target Audience
Music enthusiasts, Bandcamp users, power users who prefer keyboard navigation

## Data Handling Disclosure

### Data Types Collected
- User preferences (discovery filters)
- Temporary audio data for waveform generation

### Data Usage
- Functionality enhancement only
- No analytics or tracking
- No data sharing with third parties

### Data Storage
- Local browser storage only
- No remote servers involved
- User-controlled data retention
