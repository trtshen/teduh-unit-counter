# Chrome Permissions

## Declared Permissions (manifest.json)

### `permissions`

| Permission | Purpose |
|------------|---------|
| `storage` | Persist recent APDL lookups, unit statuses, and newly sold unit tracking using `chrome.storage.local` |
| `declarativeNetRequest` | Redirect legacy v1 URLs (`/unit-project-swasta/*`) to the current TEDUH site structure via static rules in `rules.json` |

### `host_permissions`

| Pattern | Purpose |
|---------|---------|
| `https://teduh.kpkt.gov.my/*` | Allow cross-origin `fetch()` from the extension popup to TEDUH's public REST APIs |

## Chrome Web Store Justifications

### Single Purpose Description

> Look up property project details and unit sales status (sold, unsold, total) on TEDUH (teduh.kpkt.gov.my) by APDL code, and track newly sold units between visits.

### `storage`

> Store the user's recent APDL lookup history (up to 10 entries) and previously fetched unit counts locally, enabling quick revisits and visual highlighting of newly sold units between sessions. All data is stored on-device only.

### `declarativeNetRequest`

> Redirect legacy bookmark URLs (e.g. /unit-project-swasta/*) to the current TEDUH site structure using two static redirect rules defined in rules.json. No dynamic rules are created.

### `https://teduh.kpkt.gov.my/*`

> Make cross-origin fetch requests from the extension popup to TEDUH's public REST APIs at teduh.kpkt.gov.my to retrieve project details and unit sales data by APDL code. No other domains are accessed.

### Remote Code

> No. All JavaScript is bundled in the extension package. No external scripts are loaded.

## Privacy Policy

> This extension does not collect, transmit, or share any personal data. All data (recent APDL lookups and cached unit counts) is stored locally on the user's device using Chrome's `storage.local` API. The extension communicates only with `teduh.kpkt.gov.my` to fetch publicly available project and unit data through its public REST APIs. No analytics, tracking, or third-party services are used.

## v1 → v2 Permission Changes

| Permission | v1 | v2 | Change |
|------------|----|----|--------|
| `activeTab` | Yes | No | **Removed** — no longer needed; popup fetches APIs directly |
| `scripting` | Yes | No | **Removed** — no content scripts injected |
| `tabs` | Yes (implicit) | No | **Removed** — no tab queries |
| `storage` | Yes | Yes | Unchanged |
| `declarativeNetRequest` | No | Yes | **Added** — for legacy URL redirects |
| `host_permissions` | No | Yes | **Added** — for cross-origin API fetch |
