# Bandcamp Workflow Extension - Copilot Instructions

## Project Overview
This is a browser extension (Chrome & Firefox) for Bandcamp, built with TypeScript and Webpack. It adds workflow enhancements like Vim-style bindings, wishlist management, and bulk actions.
- **Package Manager:** `pnpm`
- **Build System:** Webpack (via `pnpm webpack:chrome` / `pnpm webpack:firefox`)
- **Extension Runner:** `web-ext`

## Architectural Patterns
The application follows a Controller-Facade pattern to separate logic from the Bandcamp DOM structure.

### Core Architecture
- **Entry Point:** `src/app/content.ts` initializes the extension and instantiates `PageController`.
- **Orchestrator:** `src/app/controllers/page.controller.ts` is the central hub. It detects the page type and initializes relevant sub-controllers (e.g., `AlbumController`, `WishlistController`).
- **Data/DOM Layer:** `src/app/facades/bandcamp.facade.ts` is the **single source of truth** for:
  - Interacting with the Bandcamp DOM.
  - Accessing internal Bandcamp data (`window.TralbumData`).
  - Detecting page types (`isTrack`, `isAlbum`, `isCollectionBasedPage`).
  - **Rule:** improved DOM scraping or state reading should go here, not in controllers.

### Component Types
- **Controllers** (`src/app/controllers/`): Manage logic and UI for specific features (e.g., `SpeedController`, `KeyboardController`).
- **Services** (`src/app/services/`): Handle business logic independent of UI (e.g., `CartService`, `NotificationService`).
- **Views** (`src/app/views/`): Encapsulate UI rendering logic (e.g., `SpeedSliderView`).
- **Utils** (`src/app/utils/`): Pure functions and helpers. `Logger` is central.

## Critical Developer Workflows
- **Package Management:** Always use `pnpm`, not `npm`.
- **Build & Verify:**
  - Run `pnpm run build` after *every* significant code change to ensure TypeScript compilation and Webpack bundling succeed.
  - Fix any build errors immediately.
- **Development:**
  - `pnpm dev:chrome` or `pnpm dev:firefox` to watch for changes.
- **Linting:** `pnpm lint` / `pnpm lint:fix`.

## Implementation Details & Conventions
- **Page Detection:** Do not parse URLs manually. Use `BandcampFacade.is[PageType]` (e.g., `BandcampFacade.isTrack`).
- **Global Data:** Bandcamp's internal data is exposed on `window.TralbumData`. Access this exclusively through `BandcampFacade`.
- **Logging:** Use `src/app/utils/logger.ts`.
  - `Logger.log()` for debug info.
  - `Logger.error()` for exceptions.
  - **Constraint:** Never use emojis in log statements or code comments.
- **Background Script:** `src/app/background.ts` is minimal, primarily handling CORS bypass for waveform fetching.

## Testing & Feedback
- **No Automated Tests:** The project does not have a test suite.
- **Manual Verification:** After implementing changes, explicitly ask the user to test the feature/fix and report back with logs and observed behavior.
- **Constraint:** Do not attempt to run test commands (e.g., `npm test`).

## File Structure Reference
- `src/app/facades/bandcamp.facade.ts`: **Read this first** when needing data from the page.
- `src/app/controllers/page.controller.ts`: Main initialization logic.
- `src/app/constants.ts`: Global configuration (timeouts, classes).