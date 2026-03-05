# Teduh Unit Counter — Chrome Extension

## Project Status

**This version (v1.x) is obsoleted.** The target website https://teduh.kpkt.gov.my underwent a major frontend revamp using a different framework. The DOM selectors and content script injection logic in `popup.js` no longer work against the live site. A new approach is needed for v2.

## What This Extension Does

Helps visitors of https://teduh.kpkt.gov.my conveniently track property development projects:
- Counts unit statuses (sold / not sold) on project pages
- Tracks newly sold units between visits with visual highlighting
- Saves visited project URLs for quick revisit via dropdown
- Generates direct links from APDL codes (Advertising Permit and Developer's License)

## Tech Stack & Conventions

- **Chrome Manifest V3** — use `chrome.scripting.executeScript()` for content injection, `chrome.storage.local` for persistence
- **Vanilla JavaScript** — no frameworks, no build step; the JS runs directly in the extension popup and injected into pages
- **Testing**: Jest + jsdom with mocked Chrome APIs (`chrome.storage`, `chrome.tabs`, `chrome.scripting`)
- **Module exports**: CommonJS (`module.exports`) guarded by `typeof module !== "undefined"` for Jest compatibility
- **No TypeScript** — plain JS unless a migration is explicitly planned

## Coding Rules

- Strip query parameters from URLs before storing (`url.split('?')[0]`)
- All Chrome API calls must handle `chrome.runtime.lastError`
- DOM element IDs in `popup.html` are the contract between HTML and JS — keep them in sync
- Unit status values are in Malay: `"Telah Dijual"` (sold), `"Belum Dijual"` (not sold)
- APDL codes are extracted from URL path segments, not query params

## Planned Improvements (from todo.md)

When working on v2 or refactoring, apply these where relevant:
- Prefer `async/await` with Chrome API promise wrappers over nested callbacks
- Extract constants for selectors and regex patterns
- Validate and sanitize APDL input before generating URLs
- Support i18n/localization

## v2 Considerations

The Teduh website now uses a different frontend framework. When building v2:
- Investigate the new site's DOM structure and data-loading patterns (may use client-side rendering)
- Content scripts may need to wait for dynamic content to load (`MutationObserver` or polling)
- The `div.unit-box` selector and `data-tooltip` JSON attribute likely no longer exist — discover new selectors
- Consider using `chrome.declarativeNetRequest` or `chrome.webRequest` if data is available from API responses instead of DOM scraping
