# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser extension (Chrome & Firefox) for Bandcamp that adds workflow enhancements like keyboard shortcuts, wishlist management, playback speed control, waveform visualization, and bulk actions. Built with TypeScript and Webpack.

## Commands

- **Package manager:** Always use `pnpm`, never `npm`.
- `pnpm build` — Full production build (clean, webpack, package) for both browsers
- `pnpm build:chrome` / `pnpm build:firefox` — Build a single browser target
- `pnpm dev:chrome` / `pnpm dev:firefox` — Watch mode with auto-reload via web-ext
- `pnpm lint` / `pnpm lint:fix` — ESLint
- `pnpm format` — Prettier
- **No test suite exists.** Do not attempt to run test commands. After changes, ask the user to manually verify.
- **Always run `pnpm build` after significant changes** to verify TypeScript compilation and Webpack bundling succeed.

## Architecture

### Controller-Facade Pattern

- **Entry point:** `src/app/content.ts` bootstraps the extension and creates `PageController`.
- **Orchestrator:** `PageController` detects the Bandcamp page type and initializes relevant sub-controllers (Album, Track, Wishlist, Speed, Waveform, etc.).
- **Facade:** `src/app/facades/bandcamp.facade.ts` is the **single source of truth** for all DOM interaction and Bandcamp data access (`window.TralbumData`). New DOM scraping or state reading goes here, not in controllers.
- **Controllers** (`src/app/controllers/`) — Feature logic and UI orchestration.
- **Services** (`src/app/services/`) — Business logic independent of UI (cart, notifications, shuffle, waveform processing).
- **Views** (`src/app/views/`) — UI rendering using the Observer pattern (views observe controllers via `AbstractSubject`/`AbstractObserver`).
- **Utils** (`src/app/utils/`) — Pure functions. `Logger` is the centralized logging utility.
- **Components** (`src/app/components/`) — Lightweight reusable UI elements (Button, Input, Heart, Span) with inline styling.

### Dual Browser Support

- Chrome uses Manifest v3 (`src/manifest-chrome.json`) with service worker background.
- Firefox uses Manifest v2 (`src/manifest-firefox.json`) with `browser_action`.
- Webpack builds to `dist/chrome/` and `dist/firefox/` based on `--env` flag.
- Background script (`src/app/background.ts`) is minimal, handling CORS bypass for waveform fetching.

### SPA Navigation

The extension detects Bandcamp's SPA navigation via `popstate`, `history.pushState`/`replaceState` overrides, and periodic URL checks. It reinitializes on URL changes. URL parameters (`?wishlist=true`, `?add_to_cart=true`) trigger automatic actions.

## Conventions

- Use `BandcampFacade.is[PageType]` for page detection — never parse URLs manually.
- Access Bandcamp internal data exclusively through `BandcampFacade`.
- Use `Logger` from `src/app/utils/logger.ts` for all logging — never use `console` directly.
- No emojis in log statements or code comments.
- DOM selectors live in `src/app/utils/dom-selectors.ts` with fallback arrays for different Bandcamp UI variations.
- `src/app/constants.ts` holds global config (timeouts, seek steps, speed increments, CSS class names).
