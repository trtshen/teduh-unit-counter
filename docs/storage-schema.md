# Storage Schema

All data is persisted locally using `chrome.storage.local`. No data is transmitted to external servers.

## Keys

### `recentApdl`

Recent APDL lookup history. Maximum 10 entries. Most recent first.

**Type:** `Array<{ apdl: string, name: string }>`

**Example:**
```json
[
  { "apdl": "30343-1", "name": "TAMAN EXAMPLE PHASE 1" },
  { "apdl": "12345-2", "name": "RESIDENSI SAMPLE" }
]
```

**Written by:** `addToRecent()`, `clearRecent()`
**Read by:** `getRecentList()`

---

### `unitStatuses`

Per-APDL snapshot of the most recently seen unit statuses. Keyed by APDL code.

**Type:** `Record<string, Array<{ unitNumber: string, status: string }>>`

**Example:**
```json
{
  "30343-1": [
    { "unitNumber": "A-1", "status": "Telah Dijual" },
    { "unitNumber": "A-2", "status": "Belum Dijual" }
  ]
}
```

**Written by:** `saveUnitStatuses()`
**Read by:** `getSavedUnitStatuses()`

---

### `newlySoldUnits`

Per-APDL list of units detected as newly sold (status changed from non-sold to sold). Keyed by APDL code.

**Type:** `Record<string, Array<{ unitNumber: string, dateMarkedSold: string }>>`

**Example:**
```json
{
  "30343-1": [
    { "unitNumber": "A-2", "dateMarkedSold": "2025-03-01T10:30:00.000Z" }
  ]
}
```

**Written by:** `saveUnitStatuses()`, `clearNewlySold()`
**Read by:** `getSavedUnitStatuses()`

---

## Storage Helper Functions

| Function | Operation | Keys Affected |
|----------|-----------|---------------|
| `storageGet(keys)` | Read | Any (generic wrapper) |
| `storageSet(data)` | Write | Any (generic wrapper) |
| `getRecentList()` | Read | `recentApdl` |
| `addToRecent(apdl, name)` | Read + Write | `recentApdl` |
| `clearRecent()` | Write | `recentApdl` |
| `getSavedUnitStatuses(apdl)` | Read | `unitStatuses`, `newlySoldUnits` |
| `saveUnitStatuses(apdl, statuses, newlySold)` | Read + Write | `unitStatuses`, `newlySoldUnits` |
| `clearNewlySold(apdl)` | Read + Write | `newlySoldUnits` |

All helpers use `storageGet()` / `storageSet()` which are Promise wrappers around `chrome.storage.local.get()` / `.set()`. `storageSet()` checks `chrome.runtime.lastError` and rejects on failure.
