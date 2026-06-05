export const TIMEOUT = 1000;
export const SEEK_STEP = 10;
export const SPEED_STEP = 0.01;
export const INPUT_CLASS = 'bandcamp-workflow__input';
export const DEFAULT_SPEED = 1;
export const DEFAULT_STRETCH = false;

// CSS class names for extension-injected DOM elements. Centralized so that the
// code that creates an element and the code that queries/cleans it up (often in
// different files) reference a single source and cannot drift apart.
export const SPEED_GRID_CLASS = 'bandcamp-workflow-speed-grid';
export const DOWNLOAD_ALL_CLASS = 'bandcamp-workflow-download-all';
// Full-viewport overlay shown while the wishlist's lazy-loaded items are fetched,
// so the user sees a clean spinner instead of the page scroll-loading up and down.
export const WISHLIST_LOADING_CLASS = 'bandcamp-workflow-wishlist-loading';
export const WAVEFORM_CONTAINER_CLASS = 'bandcamp-waveform-container';
export const WAVEFORM_LOADING_CLASS = 'bandcamp-waveform-loading';
export const WAVEFORM_ERROR_CLASS = 'bandcamp-waveform-error';
// Matches any waveform element regardless of state (container/loading/error).
export const WAVEFORM_ELEMENT_SELECTOR = `.${WAVEFORM_CONTAINER_CLASS}, .${WAVEFORM_LOADING_CLASS}, .${WAVEFORM_ERROR_CLASS}`;
