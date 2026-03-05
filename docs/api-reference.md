# API Reference

All endpoints are public REST APIs on `https://teduh.kpkt.gov.my`. CORS is enabled (`access-control-allow-origin: *`).

## Base URL

```
https://teduh.kpkt.gov.my/api
```

## Endpoints Used by This Extension

### GET `/api/projek-swasta/{apdl}`

Fetch project details for a given APDL code.

**Parameters:**
| Param | In | Type | Description |
|-------|----|------|-------------|
| `apdl` | path | string | APDL code (e.g. `30343-1` or `30343`) |

**Response (200):**
```json
{
  "id": "30343-1",
  "nama": "TAMAN EXAMPLE PHASE 1",
  "pemaju": {
    "nama": "EXAMPLE DEVELOPER SDN BHD"
  },
  "status": {
    "keseluruhan": "Siap"
  },
  "lokasi": {
    "negeri": "Selangor",
    "daerah": "Petaling"
  },
  "unitSummary": {
    "jumlah": 200,
    "dijual": 180,
    "belumDijual": 20
  }
}
```

**Error Responses:**
| Status | Meaning |
|--------|---------|
| 404 | Project not found for the given APDL code |
| 500 | Server error |

**Extension usage:** Called by `fetchProjectDetails(apdl)` in `popup.js`.

---

### GET `/api/unit-projek-swasta/{apdl}`

Fetch the full unit list for a given APDL code.

**Parameters:**
| Param | In | Type | Description |
|-------|----|------|-------------|
| `apdl` | path | string | APDL code |

**Response (200):**
```json
{
  "unitGroups": [
    {
      "jenis": "A",
      "units": [
        { "no": "A-1", "statusJualan": "Telah Dijual" },
        { "no": "A-2", "statusJualan": "Belum Dijual" },
        { "no": "A-3", "statusJualan": "Telah Dijual" }
      ]
    },
    {
      "jenis": "B",
      "units": [
        { "no": "B-1", "statusJualan": "Belum Dijual" }
      ]
    }
  ]
}
```

**Unit status values (Malay):**
| Value | Meaning |
|-------|---------|
| `"Telah Dijual"` | Sold |
| `"Belum Dijual"` | Not sold / Unsold |
| Other / missing | Unknown (counted as neither sold nor unsold) |

**Error Responses:**
| Status | Meaning |
|--------|---------|
| 404 | Unit data not found |
| 500 | Server error |

**Extension usage:** Called by `fetchUnitList(apdl)` in `popup.js`.

---

## Endpoints Not Yet Used (Available for Future Features)

### GET `/api/projek-swasta?q={keyword}&search_type=projek`

Search projects by keyword (project name, developer name, etc.).

**Parameters:**
| Param | In | Type | Description |
|-------|----|------|-------------|
| `q` | query | string | Search keyword |
| `search_type` | query | string | `"projek"` |

**Extension status:** Not implemented. Listed in `todo.md` as a future feature.

---

### GET `/api/negeri`

List all states (negeri) in the system.

**Extension status:** Not used. Could support state-based filtering in the future.

---

## Fetch Configuration

Both API calls in `popup.js` use the same fetch options:

```js
{
  headers: { "Accept": "application/json" },
  credentials: "include"
}
```

- `Accept: application/json` — ensures JSON response.
- `credentials: "include"` — sends cookies if any (TEDUH may use session cookies).
- The APDL code in the URL path is always passed through `encodeURIComponent()`.
