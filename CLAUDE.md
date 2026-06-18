# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is the **single source of truth** for agent instructions; `.github/copilot-instructions.md` just points here.

## Project Overview

Browser extension (Chrome & Firefox) for Bandcamp that adds workflow enhancements like keyboard shortcuts, wishlist management, playback speed control, waveform visualization, and bulk actions. Built with TypeScript and Webpack.

## Commands

- **Package manager:** Always use `pnpm`, never `npm`.
- `pnpm build` — Full production build (clean, webpack, package) for both browsers
- `pnpm build:chrome` / `pnpm build:firefox` — Build a single browser target
- `pnpm dev:chrome` / `pnpm dev:firefox` — Watch mode with auto-reload via web-ext
- `pnpm lint` / `pnpm lint:fix` — ESLint
- `pnpm format` — Prettier
- **No automated test suite exists.** Do not attempt to run test commands (e.g. `pnpm test`) — there is no test runner.
- **Always run `pnpm build` after significant changes** to verify TypeScript compilation and Webpack bundling succeed.

## Verifying changes

- The built extension can be loaded into a real Chrome and observed on live Bandcamp — prefer this over guessing. Verification needs a Chrome **signed into a Bandcamp account**: anonymous automated traffic hits a Fastly CAPTCHA wall, and wishlist/cart features require a session. A dedicated dev account is used for this.
- After building, load `dist/chrome` as an unpacked extension, navigate to a relevant page (album / track / wishlist / collection), and confirm both the injected UI (elements whose class/id contains `bcks`, e.g. the Hotkeys/Settings sidebar) and the actual behavior.
- **Production builds hardcode the `Logger` level to `WARN`** (`src/app/utils/logger.ts`), so `Logger.debug` output does NOT appear in a normal build's console. Verify behavior via the DOM/UI and screenshots, not debug logs.
- For anything that genuinely cannot be observed, ask the user to verify.

## Testing & Safety Constraints

- **NEVER make a purchase.** Do not complete checkout, confirm an order, enter payment details, or click any final "buy"/"purchase"/"pay" confirmation on Bandcamp.
- **All other actions are permitted for testing**, including adding items to the cart, toggling wishlist, playback, seeking, and any extension feature — as long as you stop short of completing a purchase.

## Architecture

### Controller-Facade Pattern

- **Entry point:** `src/app/content.ts` bootstraps the extension, creates `PageController`, and overrides `history.pushState`/`replaceState` plus polling timers for SPA navigation.
- **Orchestrator:** `PageController` (`src/app/controllers/page.controller.ts`) detects the Bandcamp page type and initializes the relevant sub-controllers (Album, Track, Wishlist, Speed, Waveform, Keyboard, Playbar, etc.).
- **Facade:** `src/app/facades/bandcamp.facade.ts` (~545 lines, down from ~4,150) is the single source of truth for DOM/data access (`window.TralbumData`, element accessors, page DOM layout) and the public surface controllers call. Feature logic has been **decomposed** into focused modules under `src/app/facades/bandcamp/`:
  - `page-detection.ts` — `is*` page-type getters
  - `release-navigation.ts` — album/track track navigation
  - `transport.ts` — play/pause (`togglePlayPause`)
  - `track-actions.ts` — add-to-cart and wishlist toggling (`c`/`z`/`w`/`q`)
  - `wishlist-playback.ts` — the wishlist/collection continuous-playback engine (loading, advance, error recovery, scroll, verification); large but single-responsibility (could be internally sub-split later)

  The facade keeps **thin delegators** to these modules, so callers use `BandcampFacade.X` unchanged; the modules read/write facade-held shared state (e.g. `_wishlistItems`, `_currentWishlistIndex`) via `BandcampFacade` (those fields are `static`, not `private`, so they're accessible cross-module). The whole `src/` type-checks under `strictNullChecks` + `noImplicitAny` — there is no `@ts-nocheck` anywhere; keep it that way. New DOM scraping or state reading should go through the facade or the relevant module. NOTE: some controllers/services still bypass the facade with direct `document.querySelector` (see **Known debt**).
- **Controllers** (`src/app/controllers/`) — Feature logic and UI orchestration.
- **Services** (`src/app/services/`) — Business logic independent of UI (bulk cart, notifications, shuffle, waveform processing, wishlist).
- **Views** (`src/app/views/`) — UI rendering using the Observer pattern (views observe controllers via `AbstractSubject`/`AbstractObserver`). Currently used only by the Speed feature (`SpeedController` + the speed views).
- **Utils** (`src/app/utils/`) — Pure functions. `Logger` is the centralized logging utility.
- **Components** (`src/app/components/`) — Lightweight reusable UI elements (Button, Input, Heart, Span) with inline styling.

### Dual Browser Support

- Chrome uses Manifest v3 (`src/manifest-chrome.json`) with service worker background.
- Firefox uses Manifest v2 (`src/manifest-firefox.json`) with `browser_action` (uses `permissions`, not `host_permissions`).
- Webpack builds to `dist/chrome/` and `dist/firefox/` based on the `--env` flag.
- Background script (`src/app/background.ts`) is minimal, handling CORS bypass for waveform fetching — it fetches the audio in the extension context and returns it to the content script.

### SPA Navigation

The extension detects Bandcamp's SPA navigation via `popstate`, `history.pushState`/`replaceState` overrides, and a single periodic URL poll (1s), reinitializing (`PageController.cleanup()` then re-init) on URL changes. URL parameters (`?wishlist=true`, `?add_to_cart=true`, `?close_tab_after_add=true`), handled in `content.ts`, trigger automatic actions.

## Conventions

- Prefer `BandcampFacade.is[PageType]` for page detection over manual URL parsing. (Known debt: URL-param handling in `content.ts` still parses `location.search` directly.)
- Access Bandcamp internal data (`window.TralbumData`) exclusively through `BandcampFacade`.
- Use `Logger` from `src/app/utils/logger.ts` for all logging — never use `console` directly. Methods: `debug`, `warn`, `error`, `timing`, `startTiming` (**there is no `Logger.log`**). Debug is suppressed in production (WARN level).
- No emojis in log statements or code comments.
- DOM selectors should live in `src/app/utils/dom-selectors.ts` with fallback arrays for different Bandcamp UI variations. (Known debt: many call sites still hardcode inline selector strings instead.)
- `src/app/constants.ts` holds global config (timeouts, seek steps, speed increments, and the extension's injected `bcks-*`/`bcks-waveform-*` class names). (Known debt: some timeout magic numbers are still inline rather than centralized here.)

## Known debt (refactor targets)

- `bandcamp.facade.ts` was a ~4,153-line god object; it's now ~545 lines (DOM/data foundation + page layout + delegators), with feature logic moved into the `src/app/facades/bandcamp/` modules. What remains is largely legitimate facade responsibility (data/element accessors, page DOM arrangement, `hasCurrentlyPlayingTrack`, `reset`, state, delegators). Optional further extraction: the layout/DOM-arrangement methods (`arrange`/`insertBelow*`/`movePlaylist`/`rectifyMargins`) and `playFirstTrack` could move to a `layout`/release module.
- `wishlist-playback.ts` is ~2,200 lines — a single cohesive responsibility, but could be internally sub-split (loading vs. advance vs. error-recovery vs. scroll/verification).
- `keyboard-sidebar.controller.ts` (was ~925) is now ~500 lines: shortcut/setting definitions live in `controllers/keyboard-sidebar/content.ts` and DOM builders in `controllers/keyboard-sidebar/view.ts`. `add-to-cart-utils.ts` (was ~885) is now a ~52-line facade delegating to `utils/add-to-cart/{url,buttons,price,items}.ts`.
- The facade "single source of truth" rule is still partly violated — some controllers/services query the DOM directly.
- Selector centralization is partial: injected class names are centralized in `constants.ts`, but many inline selector strings remain across controllers/services.
- Type-checking is fully enabled (no `@ts-nocheck` left); the build (ts-loader) and `npx tsc --noEmit` are the type gates. A handful of DOM accessors use non-null assertions where an element is reliably present on the relevant page — prefer guards over widening these to `as any`.
