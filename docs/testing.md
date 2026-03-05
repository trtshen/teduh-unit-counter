# Testing

## Overview

- **Framework:** Jest 29 with jsdom environment
- **Test file:** `popup.test.js` (47 tests, single suite)
- **Run command:** `npm test`

## Setup

```bash
npm install      # installs jest, jsdom, jest-environment-jsdom
npm test         # runs all tests
npx jest --verbose  # runs with detailed output
```

## Test Environment

Tests run in **jsdom** (configured in `package.json` under `jest.testEnvironment`). This provides a browser-like DOM in Node.js.

### Chrome API Mocks

`chrome.storage.local` is mocked with an in-memory object:

```js
const storageMock = {
  _data: {},
  get: jest.fn((keys, cb) => { /* returns _data entries or defaults */ }),
  set: jest.fn((data, cb) => { /* merges into _data */ })
};
global.chrome = {
  storage: { local: storageMock },
  runtime: { lastError: null }
};
```

Helper functions `resetStorage(data)` and `resetDOM()` reset state between tests.

### Fetch Mock

`global.fetch` is a `jest.fn()`. The helper `mockFetchJSON(data, status)` queues a resolved fetch response:

```js
function mockFetchJSON(data, status = 200) {
  global.fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data)
  });
}
```

### DOM Fixture

A `POPUP_HTML` string mirrors the real `popup.html` structure. `resetDOM()` sets `document.body.innerHTML = POPUP_HTML` to restore a clean DOM.

## Module Loading

`popup.js` exports via CommonJS guarded by `typeof module !== "undefined"`:

```js
if (typeof module !== "undefined") {
  module.exports = { fetchProjectDetails, fetchUnitList, ... };
}
```

Tests import with `require("./popup.js")`.

## Test Coverage

| Describe Block | Tests | What's Covered |
|----------------|-------|----------------|
| Constants | 4 | `API_BASE`, `MAX_RECENT`, `APDL_PATTERN` valid/invalid |
| countUnitsFromApi | 5 | Empty data, missing fields, sold/unsold counting, unknown status |
| detectNewlySoldUnits | 5 | No previous data, newly sold detection, deduplication, edge cases |
| fetchProjectDetails | 3 | Success, 404, 500 |
| fetchUnitList | 2 | Success, 404 |
| getRecentList | 2 | Empty storage, populated storage |
| addToRecent | 3 | Add new, move existing to front, trim to MAX_RECENT |
| clearRecent | 1 | Empties list |
| getSavedUnitStatuses | 2 | Empty, populated |
| saveUnitStatuses | 1 | Saves correctly |
| clearNewlySold | 1 | Clears for specific APDL |
| showStatus | 2 | Loading and error states |
| hideStatus | 1 | Clears message |
| showProjectInfo | 2 | Full details, fallback name |
| hideProjectInfo | 1 | Removes visible class |
| renderRecentList | 3 | Renders items, hides when empty, shows when populated |
| renderNewlySold | 3 | Renders with button, empty array, null |
| validateApdl | 3 | Valid codes, empty/missing, invalid format |
| lookupApdl | 3 | Success flow, fetch failure, validation rejection |
| **Total** | **47** | |

## Conventions

- Each `describe` block matches a single exported function.
- `beforeEach` calls `resetDOM()` for UI tests and `resetStorage()` for storage tests.
- `global.fetch.mockReset()` is called before API tests.
- Assertions use `.toBe()`, `.toEqual()`, `.toContain()`, `.toHaveLength()`, `.toHaveProperty()`.
- Async tests use `async/await` with `expect(...).rejects.toThrow()` for error cases.

## Adding New Tests

1. Export the new function in the `module.exports` block of `popup.js`.
2. Import it in the destructuring at the top of `popup.test.js`.
3. Add a `describe("functionName", () => { ... })` block.
4. Use `resetDOM()` / `resetStorage()` in `beforeEach` as needed.
