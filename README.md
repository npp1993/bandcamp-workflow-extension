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

- Vim-style keybindings to greatly enhance browsing and purchasing workflow while using Bandcamp
- Wishlist individual tracks directly from release pages
- Streamlined wishlist management
- Playback speed adjustment with vinyl and stretched modes
- Add-to-Cart functionality for quickly adding tracks and albums from your wishlist to your cart from the wishlist, release pages, or track pages
- Bulk add-to-cart functionality for adding multiple wishlist items to cart at once
- Automatic loading of all wishlist items
- Always play the first track on a release page (instead of a featured track)
- Generate a ready-to-use `curl` script for bulk downloading your purchased items, including automatic extraction of downloaded ZIP files

## Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `Space` | Play/pause current track |
| `w` | Add current track to wishlist |
| `q` | Add entire release to wishlist |
| `n` | Play next track |
| `p` | Play previous track |
| `Shift + p` | Play first track in album |
| `l` or `→` | Seek 10 seconds forward |
| `h` or `←` | Seek 10 seconds backward |
| `i` | Seek to start of track |
| `↑` | Increase playback speed |
| `↓` | Decrease playback speed |
| `r` | Reset playback speed to normal |
| `c` | Add current track/album to cart |
| `b` | Enter/exit bulk selection mode (wishlist page only) |

## Bulk Selection Mode

When on the wishlist page, you can enter bulk selection mode to add multiple items to your cart at once:

1. **Enter bulk mode**: Press `b` or click the "Bulk Add to Cart" button
2. **Navigate items**: Use `n` (next) and `p` (previous) to move between items
3. **Toggle selection**: Press `f` to select/deselect the currently focused item
4. **Continuous selection**: Hold `f` and press `n`/`p` to quickly toggle multiple items in sequence
5. **Select all**: Press `a` or click "Select All" button to select all items
6. **Deselect all**: Press `d` or click "Deselect All" button to deselect all items
7. **Add to cart**: Press `b` again or click "Add Selected to Cart" to process selected items
8. **Exit mode**: Press `Esc` to exit bulk selection mode

By default, all items are selected when entering bulk mode. Selected items have a background color change, and the currently focused item has a border. The "Select All" and "Deselect All" buttons appear only when in bulk mode.

**Tip**: The continuous selection feature is great for quickly selecting or deselecting ranges of items. Hold down `f` and use `n` or `p` to navigate - each item you move to will automatically toggle its selection state.

## License

MIT © 2021-2025 - See [LICENSE](LICENSE) file for details
