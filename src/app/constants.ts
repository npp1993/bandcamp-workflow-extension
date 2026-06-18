export const TIMEOUT = 1000;
export const SEEK_STEP = 10;
// Larger seek increment used with the Shift modifier (Shift+H / Shift+L).
export const SEEK_STEP_LARGE = 30;
export const SPEED_STEP = 0.01;
export const INPUT_CLASS = 'bcks__input';
export const DEFAULT_SPEED = 1;
export const DEFAULT_STRETCH = false;

// CSS class names for extension-injected DOM elements. Centralized so that the
// code that creates an element and the code that queries/cleans it up (often in
// different files) reference a single source and cannot drift apart.
export const SPEED_GRID_CLASS = 'bcks-speed-grid';
export const DOWNLOAD_ALL_CLASS = 'bcks-download-all';
// Full-viewport overlay shown while the wishlist's lazy-loaded items are fetched,
// so the user sees a clean spinner instead of the page scroll-loading up and down.
export const WISHLIST_LOADING_CLASS = 'bcks-wishlist-loading';
// Persistent fixed-height slot that holds the waveform (and its loading/error
// states) on track/album pages, so starting playback never shifts the page down.
export const WAVEFORM_HOST_CLASS = 'bcks-waveform-host';
export const WAVEFORM_CONTAINER_CLASS = 'bcks-waveform-container';
export const WAVEFORM_LOADING_CLASS = 'bcks-waveform-loading';
export const WAVEFORM_ERROR_CLASS = 'bcks-waveform-error';
// Matches any waveform element regardless of state (container/loading/error).
export const WAVEFORM_ELEMENT_SELECTOR = `.${WAVEFORM_CONTAINER_CLASS}, .${WAVEFORM_LOADING_CLASS}, .${WAVEFORM_ERROR_CLASS}`;
