# Changelog

## v2.0.0

Complete rewrite — API-first architecture replacing DOM scraping.

### Breaking Changes

- Removed all content scripts and DOM scraping logic.
- Removed `activeTab`, `scripting`, and `tabs` permissions.
- Old v1 bookmarks to `/unit-project-swasta/` are redirected automatically via `declarativeNetRequest`.

### Added

- **API-first data fetching** — project details from `GET /api/projek-swasta/{apdl}`, unit list from `GET /api/unit-projek-swasta/{apdl}`.
- **APDL input validation** — validates format (`/^\d+(-\d+)?$/`) before API call with user-facing error messages.
- **Newly sold unit detection** — compares current unit statuses against previously saved data to highlight units that changed from unsold to sold.
- **Recent APDL history** — stores up to 10 recent lookups with clickable quick-access list.
- **Loading/error status** — visual feedback during API fetch and on errors.
- **Legacy URL redirects** — `declarativeNetRequest` rules redirect old v1 URLs to current TEDUH structure.
- **`host_permissions`** — `https://teduh.kpkt.gov.my/*` for cross-origin API access.
- **`declarativeNetRequest` permission** — for static redirect rules.
- **Background service worker** — minimal `background.js` (logs on install only).
- **Full test suite** — 47 Jest tests covering all exported functions.
- **Promise-wrapped storage** — `storageGet()` / `storageSet()` async helpers for `chrome.storage.local`.
- **Validation function** — `validateApdl()` checks for empty input and invalid APDL format.

### Removed

- Content script injection (`chrome.scripting.executeScript`).
- Tab querying (`chrome.tabs.query`).
- DOM element scraping for unit counts and project titles.
- `activeTab`, `scripting` permissions.
- Visited URL dropdown (replaced by recent APDL list).
- `cleanupInvalidStorageEntries()` and related legacy storage cleanup.

### Changed

- Popup UI completely redesigned — card-based layout with unit count cards, recent list, and status messages.
- Storage schema changed — now uses `recentApdl`, `unitStatuses`, `newlySoldUnits` keys (see `docs/storage-schema.md`).
- Extension name changed from "Teduh: Unit Counter" to "TEDUH APDL Fast Access".

---

## v1.x (legacy)

Original version — DOM scraping via content scripts.

- Used `chrome.scripting.executeScript` to inject `countUnits()` and `getTitle()` into the active TEDUH page.
- Required user to be on a `teduh.kpkt.gov.my/unit-project-swasta/` URL.
- Stored visited URLs with project titles for a dropdown revisit list.
- Permissions: `activeTab`, `scripting`, `storage`.
