# Bandcamp Workflow Extension

A browser extension for [Bandcamp](https://www.bandcamp.com/) that adds numerous features and Vim-style keybindings to improve your music browsing workflow.

## Acknowledgments

This extension builds upon the work of three projects:

- [bandcamp-plus--extension](https://github.com/bamdadfr/bandcamp-plus--extension) by Bamdad Sabbagh - The original foundation for this extension
- [bandcamp-streamer](https://github.com/AFlowOfCode/bandcamp-streamer) by A Flow of Code and Lucas Heymès - Streaming functionality
- [BandcampEnhancementSuite](https://github.com/sabjorn/BandcampEnhancementSuite) by S. A. Bjørn - Additional features and improvements

Beyond that, it was completely built with VS Code Copilot's Agent Mode.

Icons were created by [Dharu Ghazi](https://www.fiverr.com/dghzdesign).

## Features

- Vim-style keybindings to greatly enhance music browsing and purchasing workflow while using Bandcamp
- Wishlist individual tracks directly from release pages
- Add-to-Cart functionality for quickly adding tracks and albums to your cart from the wishlist, release pages, or track pages
- Bulk add-to-cart functionality for adding multiple wishlist items to your cart at once
- Automatic loading of all wishlist items
- Always play the first track on a release page (instead of a featured track)
- Playback speed adjustment with vinyl and stretched modes
- Generate a ready-to-use `curl` script for bulk downloading your purchased items, including automatic extraction of downloaded ZIP files

## Keyboard Shortcuts

| Shortcut | Function | Available On |
|----------|----------|--------------|
| `Space` | Play/pause current track | All pages |
| `w` | Add current track to wishlist | All pages |
| `q` | Add entire release to wishlist | Album pages only |
| `n` | Play next track | All pages |
| `p` | Play previous track | All pages |
| `l` or `→` | Seek 10 seconds forward | All pages |
| `h` or `←` | Seek 10 seconds backward | All pages |
| `i` | Seek to start of track | All pages |
| `↑` | Increase playback speed | Album/track pages only |
| `↓` | Decrease playback speed | Album/track pages only |
| `r` | Reset playback speed to normal | Album/track pages only |
| `c` | Add current track to cart | Album/track/wishlist pages only (requires track selection on album pages) |
| `z` | Add current album to cart | Album pages only |
| `Shift + c` | Add current track to cart and close tab | Wishlist pages only |
| `s` | Toggle shuffle mode for next track navigation | Wishlist/collection pages only |
| `b` | Enter/exit bulk selection mode | Wishlist pages only |

### Page Types

The extension recognizes different page types and enables different features accordingly:

- **Album/Track Pages**: Individual release pages with track listings and playback controls
  - Keyboard transport controls (seeking within tracks and skipping between tracks)
  - Add current track to cart (c) is available when a track is selected/playing
  - Add current album to cart (z) is available on album pages
  - Speed controls (↑/↓/r) are available
  - Click "Vinyl" button to toggle between "Vinyl" and "Stretch" speed adjustment modes

- **Wishlist Pages**: Your personal wishlist (bandcamp.com/username/wishlist)
  - Bulk selection mode (b) is available
  - Shift+C to add to cart and close tab is available
  - Transport controls work with wishlist items
  - Auto-scrolling keeps the currently playing track visible when using n/p navigation
  - Shuffle mode (s) randomizes next track selection to avoid predictable playback

- **Collection Pages**: Your music collection (bandcamp.com/username)
  - Transport controls (space/n/p/h/l/i) work with collection items
  - Auto-scrolling keeps the currently playing track visible when using n/p navigation
  - Shuffle mode (s) randomizes next track selection to avoid predictable playback
  - Speed controls and add to cart features are disabled

## Bulk Purchase Mode

When on the wishlist page, you can enter Bulk Purchase Mode to add multiple items to your cart at once:

1. **Enter Bulk Purchase Mode**: Press `b` or click the "Bulk Purchase" button
2. **Navigate items**: Use `n` (next) and `p` (previous) to move between items
3. **Toggle selection**: Press `f` to select/deselect the currently focused item
4. **Continuous selection**: Hold `f` and press `n`/`p` to quickly toggle multiple items in sequence
5. **Select all**: Press `a` or click "Select All" button to select all items
6. **Deselect all**: Press `d` or click "Deselect All" button to deselect all items
7. **Add to cart**: Press `c` or click "Add Selected to Cart" to process selected items
8. **Exit mode**: Press `b` or `Esc` to exit Bulk Purchase Mode

By default, all items are selected when entering bulk mode. Selected items have a background color change, and the currently focused item has a border. The "Select All" and "Deselect All" buttons appear only when in bulk mode.

**Tip**: The continuous selection feature is great for quickly selecting or deselecting ranges of items. Hold down `f` and use `n` or `p` to navigate - each item you move to will automatically toggle its selection state.

## License

MIT © 2021-2025 - See [LICENSE](LICENSE) file for details
