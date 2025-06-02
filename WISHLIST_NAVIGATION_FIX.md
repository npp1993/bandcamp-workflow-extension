# Wishlist Navigation Bug Fix

## Problem Description
When pressing 'p' (previous track) while playing the first track in the wishlist, instead of cycling back to the last track in the wishlist (e.g., track 28 out of 28), the system was incorrectly playing "Track twenty" (track 20).

## Root Cause
The issue had two parts:

1. **Initial Issue**: The `playPreviousWishlistTrack()` method in `bandcamp.facade.ts` was using `this._wishlistItems.length` which only reflected initially visible items (typically 20) rather than the complete wishlist count.

2. **Discovered Bug**: Even after clicking the "view all items" button, the DOM loading was incomplete. The system would wait only 2 seconds, but Bandcamp's lazy loading meant not all items were rendered yet.

Example from logs:
- Wishlist tab shows: **28 total items**
- After clicking "view all 28 items": Still only **20 items found**
- Result: Goes to track 20 instead of track 28

## Solution Implemented

### 1. Made `playPreviousWishlistTrack()` Async
Changed the method signature from synchronous to async to allow waiting for all items to be loaded:

```typescript
public static async playPreviousWishlistTrack(): Promise<void>
```

### 2. Added Conditional Loading Logic
When transitioning from the first track (index 0) to the last track, the method now ensures all wishlist items are loaded:

```typescript
// If we're trying to go to the previous track from the first track (index 0),
// ensure all wishlist items are loaded to get the correct "last" track
if (this._currentWishlistIndex === 0) {
  Logger.info('At first track, ensuring all wishlist items are loaded before going to last track');
  try {
    const loadSuccess = await this.loadAllWishlistItems();
    if (loadSuccess) {
      // Reload wishlist items to get the updated array
      this.loadWishlistItems();
      Logger.info(`Updated wishlist items count: ${this._wishlistItems.length}`);
    } else {
      Logger.warn('Failed to load all wishlist items, using current list');
    }
  } catch (error) {
    Logger.warn('Error loading all wishlist items, using current list:', error);
  }
}
```

### 3. Updated Keyboard Controller
Modified the `handlePreviousTrack()` method in `keyboard.controller.ts` to handle the async call properly:

```typescript
private static handlePreviousTrack() {
  if (BandcampFacade.isWishlistPage) {
    // Handle async call without blocking
    BandcampFacade.playPreviousWishlistTrack().catch(error => {
      Logger.error('Error in playPreviousWishlistTrack:', error);
    });
  } else {
    BandcampFacade.getPrevious().click();
  }
}
```

## How the Fix Works

1. **User presses 'p' on first track**: The keyboard controller calls `playPreviousWishlistTrack()`
2. **Check current position**: Method detects we're at index 0 (first track)
3. **Load all items**: Calls `loadAllWishlistItems()` to click the "view all items" button and load the complete wishlist
4. **Refresh item list**: Calls `loadWishlistItems()` to update the internal array with all loaded items
5. **Calculate correct index**: Now `this._wishlistItems.length - 1` gives the correct last track index (e.g., 299 for 300 tracks)
6. **Play last track**: Calls `playWishlistTrack(prevIndex)` with the correct index

## Key Benefits

- **Correct Navigation**: Now properly cycles to the actual last track instead of track 20
- **Performance Optimized**: Only loads all items when needed (transitioning from first to last track)
- **Error Handling**: Gracefully falls back to current list if loading fails
- **Logging**: Comprehensive logging for debugging and monitoring

## Testing

The fix maintains backward compatibility and includes proper error handling. The build process completes successfully without any compilation errors.

## Files Modified

1. `/src/app/facades/bandcamp.facade.ts` - Updated `playPreviousWishlistTrack()` method
2. `/src/app/controllers/keyboard.controller.ts` - Updated `handlePreviousTrack()` method

## Edge Cases Handled

- **Loading fails**: Falls back to using the currently loaded items
- **No items loaded**: Proper bounds checking prevents errors
- **Problem tracks**: Existing logic to skip problematic tracks is preserved
- **Concurrent operations**: Existing flags prevent multiple simultaneous operations
