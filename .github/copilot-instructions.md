# TEDUH APDL Fast Access — Chrome Extension

## Project Status

**v2.0.0** — complete rewrite. The extension now uses TEDUH's public REST APIs directly instead of DOM scraping via content scripts. No content scripts are needed.

## What This Extension Does

Quick-access Chrome extension for https://teduh.kpkt.gov.my property development tracking:
- Look up any project by APDL code (Advertising Permit and Developer's License)
- Display project details, unit counts (total / sold / unsold) fetched from public APIs
- Track newly sold units between visits with visual highlighting
- Maintain a recent APDL lookup history (max 10) for quick revisit
- Redirect legacy `/unit-project-swasta/` URLs via declarativeNetRequest

## Architecture

- **API-first**: All data comes from public REST APIs (`GET /api/projek-swasta/{apdl}`, `GET /api/unit-projek-swasta/{apdl}`). No DOM scraping.
- **No content scripts**: The popup fetches data directly; `host_permissions` grants access to `https://teduh.kpkt.gov.my/*`
- **declarativeNetRequest**: `rules.json` redirects legacy v1 URLs to the new site structure
- **Service worker**: Minimal `background.js` — only logs on install
- See `docs/architecture.md` for full details, flow diagrams, and DOM contract.

## Tech Stack & Conventions

- **Chrome Manifest V3** — `chrome.storage.local` for persistence, `declarativeNetRequest` for redirects
- **Vanilla JavaScript** — no frameworks, no build step; popup.js runs in the extension popup
- **Testing**: Jest + jsdom with mocked Chrome APIs (`chrome.storage`) and mocked `global.fetch` — see `docs/testing.md`
- **Module exports**: CommonJS (`module.exports`) guarded by `typeof module !== "undefined"` for Jest compatibility
- **No TypeScript** — plain JS unless a migration is explicitly planned

## Key Files

- `popup.js` — All extension logic: API fetching, unit counting, storage, UI rendering, validation
- `popup.html` / `popup.css` — Popup UI with APDL input, project info cards, recent list
- `background.js` — Minimal MV3 service worker
- `rules.json` — declarativeNetRequest redirect rules
- `popup.test.js` — 47 Jest tests covering all exported functions

## Documentation

All project documentation lives in `docs/`:
- `docs/architecture.md` — System design, file structure, module map, DOM contract
- `docs/api-reference.md` — TEDUH REST API endpoints and response schemas
- `docs/storage-schema.md` — chrome.storage.local keys and data shapes
- `docs/permissions.md` — Chrome permissions, CWS justifications, privacy policy
- `docs/testing.md` — Test setup, conventions, coverage table
- `docs/changelog.md` — Version history

## File & Output Rules

- **All new files** (code, config, docs, logs, temp output) must be created inside this project directory. Never write files to `/tmp`, home directory, or other locations outside the project.
- **Log and output files** go in `./output/` — this folder is gitignored (except `.gitkeep`).
- **Documentation** goes in `./docs/`.
- **Test output** should be redirected to `./output/` (e.g. `npx jest --verbose > ./output/test-results.txt 2>&1`).

## API Endpoints (public, CORS enabled)

- `GET /api/projek-swasta/{apdl}` — Project details (nama, pemaju, status, lokasi, unitSummary)
- `GET /api/unit-projek-swasta/{apdl}` — Unit list (unitGroups → units with statusJualan)
- `GET /api/projek-swasta?q={keyword}&search_type=projek` — Search projects
- `GET /api/negeri` — States list

## Coding Rules

- All Chrome API calls must handle `chrome.runtime.lastError`
- DOM element IDs in `popup.html` are the contract between HTML and JS — keep them in sync
- Unit status values are in Malay: `"Telah Dijual"` (sold), `"Belum Dijual"` (not sold)
- APDL codes match `/^\d+(-\d+)?$/` (digits, optionally followed by dash-digits)
- Validate APDL input with `validateApdl()` before making API calls
- Use `async/await` with promise wrappers for Chrome APIs (`storageGet`, `storageSet`)
- Constants at top of file: `API_BASE`, `TEDUH_SEARCH_URL`, `MAX_RECENT`, `APDL_PATTERN`

## Remaining Work

- Support i18n/localization
- Add offline caching / fallback display of last-known data
- Consider search-by-keyword feature (API supports it)
- Publish to Chrome Web Store

