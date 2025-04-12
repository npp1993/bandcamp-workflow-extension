# Bandcamp Workflow Extension

A browser extension for [Bandcamp](https://www.bandcamp.com/) that adds numerous features and keyboard shortcuts to improve your music browsing workflow.

## Acknowledgments

This extension builds upon the work of three projects:

- [bandcamp-plus--extension](https://github.com/bamdadfr/bandcamp-plus--extension) by Bamdad Sabbagh - The original foundation for this extension
- [bandcamp-streamer](https://github.com/AFlowOfCode/bandcamp-streamer) by A Flow of Code and Lucas Heymès - Streaming functionality
- [BandcampEnhancementSuite](https://github.com/sabjorn/BandcampEnhancementSuite) by S. A. Bjørn - Additional features and improvements

Beyond that, it was completely built with VS Code Copilot's Agent Mode.

## Features

- Wishlist individual tracks directly from release pages
- Intuitive keyboard shortcuts for navigating within and between tracks
- Streamlined wishlist management
- Playback speed adjustment with vinyl and stretched modes
- Add-to-Cart functionality for quickly adding tracks and albums from your wishlist to your cart
- Automatic loading of all wishlist items

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
| `a` | Load all wishlist items (on wishlist page) |
| `c` | Add current track to cart |

## Add-to-Cart Feature

The extension includes an Add-to-Cart feature that lets you quickly move tracks into your cart that are in your wishlist:

1. When you click a buy link from your wishlist, the extension adds `?add_to_cart=true` to the URL
2. On track/album pages with this parameter, the extension will:
   - Automatically find and click the buy button
   - Set appropriate pricing:
     - For items with a minimum price, it sets exactly that amount
     - For "name your price" tracks, it sets $1.00
     - For "name your price" albums, it sets $5.00. Consider increasing this for albums)
   - Add the item to your cart

This feature is only activated when the `add_to_cart=true` parameter is explicitly included in the URL.

## License

MIT © 2021-2025 - See [LICENSE](LICENSE) file for details
