# Chrome Web Store Submission Notes

This document contains the required justifications for Chrome Web Store submission.

## Chrome Web Store Review Questions

### What is the single purpose of this extension?

This extension enhances the Bandcamp music platform with keyboard shortcuts that allow users to navigate, play, wishlist, and purchase music without using a mouse. The core functionality centers around making Bandcamp more efficient for power users who prefer keyboard navigation.

### What does this extension do and why should users install it?

This extension transforms Bandcamp into a keyboard-navigable music platform by adding shortcuts for playback control, track navigation, and wishlisting items.  Wishlisted tracks and albums can also easily be added to a user's cart in bulk from the wishlist page.

Users should install this extension to save time by navigating and purchasing music much faster using keyboard shortcuts instead of mouse clicks. It improves workflow for music enthusiasts who browse extensive catalogs or manage large wishlists, and enhances accessibility by providing keyboard-only navigation for those who prefer or require it. Music collectors and DJs also benefit from playback speed controls and waveform visualization, making it a valuable tool for music browsing.

Features include:

- Keyboard shortcuts for playback, navigation, and cart actions (Vim-style: Spacebar, N/P, C, Z, arrow keys, B)
- Enhanced wishlist management: bulk purchase, automatic loading, and direct wishlisting from release pages
- Playback speed controls with vinyl/stretched modes and quick reset
- Visual waveform display for audio analysis
- Keyboard-only navigation for accessibility and productivity
- Streamlined workflow for music collectors, musicians, and DJs

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

### Category
Productivity

## Data Handling Disclosure

### Data Types Collected
- Temporary audio data for waveform generation

### Data Usage
- Functionality enhancement only
- No analytics or tracking
- No data sharing with third parties

### Data Storage
- Local browser storage only
- No remote servers involved
- User-controlled data retention
