# Architecture

## Overview

TEDUH APDL Fast Access is a Chrome Manifest V3 extension that looks up property development projects on [teduh.kpkt.gov.my](https://teduh.kpkt.gov.my) by APDL code. It fetches data from public REST APIs and displays project details, unit counts, and newly sold unit tracking in a popup window.

## Design Principles

- **API-first** — all data comes from public REST endpoints; no DOM scraping or content script injection.
- **No build step** — vanilla JavaScript, single-file logic (`popup.js`), runs directly in the extension popup.
- **Minimal background** — the service worker (`background.js`) only logs on install; all business logic lives in the popup.

## High-Level Flow

```
User enters APDL code
        │
        ▼
  validateApdl()
        │
   ┌────┴────┐
   │ invalid  │ → showStatus(error)
   └─────────┘
        │ valid
        ▼
  fetchProjectDetails()  ─┐
  fetchUnitList()         ─┤  (parallel fetch)
                           │
        ┌──────────────────┘
        ▼
  countUnitsFromApi()
  detectNewlySoldUnits()
        │
        ▼
  saveUnitStatuses()
  addToRecent()
        │
        ▼
  showProjectInfo()
  renderNewlySold()
  renderRecentList()
```

## File Structure

```
├── manifest.json          # Chrome MV3 manifest
├── popup.html             # Popup UI markup
├── popup.css              # Popup styles
├── popup.js               # All extension logic (API, storage, UI, validation)
├── popup.test.js          # Jest test suite (47 tests)
├── background.js          # Minimal service worker
├── rules.json             # declarativeNetRequest redirect rules
├── package.json           # npm config (Jest dev dependency)
├── todo.md                # Development task tracking
├── docs/                  # Project documentation
│   ├── architecture.md    # This file
│   ├── api-reference.md   # TEDUH API endpoints
│   ├── storage-schema.md  # chrome.storage.local data shapes
│   ├── permissions.md     # Chrome permissions & CWS justifications
│   ├── testing.md         # Test setup and conventions
│   └── changelog.md       # Version history
├── output/                # Local output/log files (gitignored)
├── assets/                # Screenshots and images
└── .github/
    └── copilot-instructions.md
```

## Module Structure (popup.js)

All logic lives in `popup.js`, organized into sections:

| Section | Functions | Purpose |
|---------|-----------|---------|
| Constants | `API_BASE`, `TEDUH_SEARCH_URL`, `MAX_RECENT`, `APDL_PATTERN` | Configuration values |
| API | `fetchProjectDetails()`, `fetchUnitList()` | HTTP calls to TEDUH REST APIs |
| Unit counting | `countUnitsFromApi()`, `detectNewlySoldUnits()` | Business logic for unit status |
| Storage helpers | `storageGet()`, `storageSet()`, `getRecentList()`, `addToRecent()`, `clearRecent()`, `getSavedUnitStatuses()`, `saveUnitStatuses()`, `clearNewlySold()` | Promise-wrapped chrome.storage.local |
| UI | `showStatus()`, `hideStatus()`, `showProjectInfo()`, `hideProjectInfo()`, `renderNewlySold()`, `renderRecentList()` | DOM rendering |
| Validation | `validateApdl()` | Input validation before API call |
| Core lookup | `lookupApdl()` | Orchestrates validation → fetch → count → persist → render |
| Init | `initPopup()` | Wires up event listeners on DOMContentLoaded |
| Exports | `module.exports` | CommonJS exports guarded by `typeof module !== "undefined"` for Jest |

## DOM Contract

The popup HTML element IDs are the contract between `popup.html` and `popup.js`:

| Element ID | Type | Purpose |
|------------|------|---------|
| `apdl-input` | `<input>` | APDL code text input |
| `open-btn` | `<button>` | Triggers lookup |
| `status-msg` | `<div>` | Loading/error messages |
| `project-info` | `<div>` | Container for project details (hidden/visible) |
| `project-name` | `<h2>` | Project name |
| `project-code` | `<span>` | APDL code display |
| `project-status` | `<span>` | Project status |
| `teduh-link` | `<a>` | Link to TEDUH search page |
| `total-units` | `<span>` | Total unit count |
| `sold-count` | `<span>` | Sold unit count |
| `unsold-count` | `<span>` | Unsold unit count |
| `newly-sold-section` | `<div>` | Newly sold unit alerts |
| `recent-section` | `<div>` | Recent lookup container |
| `recent-list` | `<ul>` | Recent APDL list |
| `clear-recent` | `<button>` | Clear history button |
| `mark-read-btn` | `<button>` | Dismiss newly sold alert (dynamically created) |

## Legacy URL Redirects

`rules.json` contains two `declarativeNetRequest` rules that redirect legacy v1 URLs:

| Rule | From | To |
|------|------|----|
| 1 | `teduh.kpkt.gov.my/unit-project-swasta/{apdl}/{unit}` | `teduh.kpkt.gov.my/semakan-status-kemajuan?apdl={apdl}&unit={unit}` |
| 2 | `teduh.kpkt.gov.my/unit-project-swasta/{apdl}` | `teduh.kpkt.gov.my/semakan-status-kemajuan?apdl={apdl}` |

These are static rules processed by Chrome's declarativeNetRequest engine; no runtime code is needed.
