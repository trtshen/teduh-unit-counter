/**
 * Unit tests for popup.js v2
 * - Jest + jsdom
 * - Mocks: chrome.storage.local, chrome.runtime, global fetch
 */

// --- Chrome API mocks ---
const storageMock = {
  _data: {},
  get: jest.fn((keys, cb) => {
    const result = {};
    if (typeof keys === "object" && !Array.isArray(keys)) {
      for (const [k, def] of Object.entries(keys)) {
        result[k] = storageMock._data[k] !== undefined ? storageMock._data[k] : def;
      }
    }
    cb(result);
  }),
  set: jest.fn((data, cb) => {
    Object.assign(storageMock._data, data);
    if (cb) cb();
  })
};

global.chrome = {
  storage: { local: storageMock },
  runtime: { lastError: null }
};

// --- fetch mock ---
global.fetch = jest.fn();

// --- Load module ---
const mod = require("./popup.js");
const {
  fetchProjectDetails,
  fetchUnitList,
  countUnitsFromApi,
  detectNewlySoldUnits,
  getRecentList,
  addToRecent,
  clearRecent,
  getSavedUnitStatuses,
  saveUnitStatuses,
  clearNewlySold,
  showStatus,
  hideStatus,
  showProjectInfo,
  hideProjectInfo,
  renderNewlySold,
  renderRecentList,
  validateApdl,
  lookupApdl,
  APDL_PATTERN,
  API_BASE,
  MAX_RECENT
} = mod;

// --- Popup HTML fixture ---
const POPUP_HTML = [
  '<div class="search-form">',
  '  <input type="text" id="apdl-input" placeholder="APDL code" autofocus>',
  '  <button id="open-btn">Open</button>',
  "</div>",
  '<div id="status-msg"></div>',
  '<div id="project-info">',
  '  <div class="project-header">',
  '    <h2 id="project-name"></h2>',
  '    <a id="teduh-link" href="#" target="_blank">Open in TEDUH</a>',
  "  </div>",
  '  <div class="project-meta">',
  '    <span id="project-code"></span>',
  '    <span id="project-status"></span>',
  "  </div>",
  '  <div class="unit-counts">',
  '    <div class="count-card total">',
  '      <span class="count-value" id="total-units">-</span>',
  '      <span class="count-label">Total</span>',
  "    </div>",
  '    <div class="count-card sold">',
  '      <span class="count-value" id="sold-count">-</span>',
  '      <span class="count-label">Sold</span>',
  "    </div>",
  '    <div class="count-card unsold">',
  '      <span class="count-value" id="unsold-count">-</span>',
  '      <span class="count-label">Unsold</span>',
  "    </div>",
  "  </div>",
  '  <div id="newly-sold-section"></div>',
  "</div>",
  '<div id="recent-section">',
  '  <h3>Recent <button id="clear-recent" class="clear-btn">&times;</button></h3>',
  '  <ul id="recent-list"></ul>',
  "</div>"
].join("\n");

// --- Helpers ---
function resetDOM() {
  document.body.innerHTML = POPUP_HTML;
}

function resetStorage(data) {
  storageMock._data = data ? Object.assign({}, data) : {};
  storageMock.get.mockClear();
  storageMock.set.mockClear();
}

function mockFetchJSON(data, status) {
  var s = status || 200;
  global.fetch.mockResolvedValueOnce({
    ok: s >= 200 && s < 300,
    status: s,
    json: function () { return Promise.resolve(data); }
  });
}

// =====================================================
//  Constants
// =====================================================

describe("Constants", () => {
  it("API_BASE points to teduh API", () => {
    expect(API_BASE).toBe("https://teduh.kpkt.gov.my/api");
  });

  it("MAX_RECENT is 10", () => {
    expect(MAX_RECENT).toBe(10);
  });

  it("APDL_PATTERN matches valid APDL codes", () => {
    expect(APDL_PATTERN.test("30343-1")).toBe(true);
    expect(APDL_PATTERN.test("1-2")).toBe(true);
    expect(APDL_PATTERN.test("12345-67")).toBe(true);
    expect(APDL_PATTERN.test("30343")).toBe(true);
    expect(APDL_PATTERN.test("7")).toBe(true);
  });

  it("APDL_PATTERN rejects invalid codes", () => {
    expect(APDL_PATTERN.test("abc")).toBe(false);
    expect(APDL_PATTERN.test("-1")).toBe(false);
    expect(APDL_PATTERN.test("")).toBe(false);
    expect(APDL_PATTERN.test("ABC-123")).toBe(false);
    expect(APDL_PATTERN.test("123-")).toBe(false);
  });
});

// =====================================================
//  countUnitsFromApi
// =====================================================

describe("countUnitsFromApi", () => {
  it("returns zeros for empty unitGroups", () => {
    expect(countUnitsFromApi({ unitGroups: [] })).toEqual({
      totalUnits: 0, soldCount: 0, notSoldCount: 0, unitStatuses: []
    });
  });

  it("returns zeros when unitGroups is missing", () => {
    expect(countUnitsFromApi({})).toEqual({
      totalUnits: 0, soldCount: 0, notSoldCount: 0, unitStatuses: []
    });
  });

  it("counts sold and unsold units across groups", () => {
    const data = {
      unitGroups: [
        {
          jenis: "A",
          units: [
            { no: "A-1", statusJualan: "Telah Dijual" },
            { no: "A-2", statusJualan: "Belum Dijual" }
          ]
        },
        {
          jenis: "B",
          units: [
            { no: "B-1", statusJualan: "Telah Dijual" },
            { no: "B-2", statusJualan: "Telah Dijual" },
            { no: "B-3", statusJualan: "Belum Dijual" }
          ]
        }
      ]
    };
    const result = countUnitsFromApi(data);
    expect(result.totalUnits).toBe(5);
    expect(result.soldCount).toBe(3);
    expect(result.notSoldCount).toBe(2);
    expect(result.unitStatuses).toHaveLength(5);
  });

  it("handles units with unknown status", () => {
    const data = {
      unitGroups: [{
        jenis: "X",
        units: [
          { no: "X-1", statusJualan: "Reserved" },
          { no: "X-2" }
        ]
      }]
    };
    const result = countUnitsFromApi(data);
    expect(result.totalUnits).toBe(2);
    expect(result.soldCount).toBe(0);
    expect(result.notSoldCount).toBe(0);
    expect(result.unitStatuses[1].status).toBe("Unknown");
  });

  it("handles group with no units array", () => {
    const data = { unitGroups: [{ jenis: "Empty" }] };
    const result = countUnitsFromApi(data);
    expect(result.totalUnits).toBe(0);
  });
});

// =====================================================
//  detectNewlySoldUnits
// =====================================================

describe("detectNewlySoldUnits", () => {
  it("returns empty when no previous data", () => {
    const current = [{ unitNumber: "A-1", status: "Telah Dijual" }];
    expect(detectNewlySoldUnits(current, [], [])).toEqual([]);
  });

  it("detects unit changed from unsold to sold", () => {
    const previous = [{ unitNumber: "A-1", status: "Belum Dijual" }];
    const current = [{ unitNumber: "A-1", status: "Telah Dijual" }];
    const result = detectNewlySoldUnits(current, previous, []);
    expect(result).toHaveLength(1);
    expect(result[0].unitNumber).toBe("A-1");
    expect(result[0]).toHaveProperty("dateMarkedSold");
  });

  it("does not duplicate already-tracked newly sold", () => {
    const previous = [{ unitNumber: "A-1", status: "Belum Dijual" }];
    const current = [{ unitNumber: "A-1", status: "Telah Dijual" }];
    const existing = [{ unitNumber: "A-1", dateMarkedSold: "2024-01-01T00:00:00Z" }];
    const result = detectNewlySoldUnits(current, previous, existing);
    expect(result).toHaveLength(1);
    expect(result[0].dateMarkedSold).toBe("2024-01-01T00:00:00Z");
  });

  it("ignores units still unsold", () => {
    const previous = [{ unitNumber: "A-1", status: "Belum Dijual" }];
    const current = [{ unitNumber: "A-1", status: "Belum Dijual" }];
    expect(detectNewlySoldUnits(current, previous, [])).toEqual([]);
  });

  it("ignores units that were already sold before", () => {
    const previous = [{ unitNumber: "A-1", status: "Telah Dijual" }];
    const current = [{ unitNumber: "A-1", status: "Telah Dijual" }];
    expect(detectNewlySoldUnits(current, previous, [])).toEqual([]);
  });
});

// =====================================================
//  fetchProjectDetails
// =====================================================

describe("fetchProjectDetails", () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  it("returns JSON on success", async () => {
    const project = { id: "30343-1", nama: "Test Project" };
    mockFetchJSON(project);
    const result = await fetchProjectDetails("30343-1");
    expect(result).toEqual(project);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://teduh.kpkt.gov.my/api/projek-swasta/30343-1",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("throws Project not found on 404", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchProjectDetails("99999-0")).rejects.toThrow("Project not found");
  });

  it("throws API error on other failures", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchProjectDetails("30343-1")).rejects.toThrow("API error (500)");
  });
});

// =====================================================
//  fetchUnitList
// =====================================================

describe("fetchUnitList", () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  it("returns JSON on success", async () => {
    const units = { unitGroups: [] };
    mockFetchJSON(units);
    const result = await fetchUnitList("30343-1");
    expect(result).toEqual(units);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://teduh.kpkt.gov.my/api/unit-projek-swasta/30343-1",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("throws on 404", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchUnitList("99999-0")).rejects.toThrow("Unit data not found");
  });
});

// =====================================================
//  Storage: getRecentList / addToRecent / clearRecent
// =====================================================

describe("getRecentList", () => {
  it("returns empty array when storage is empty", async () => {
    resetStorage();
    const list = await getRecentList();
    expect(list).toEqual([]);
  });

  it("returns stored recent list", async () => {
    resetStorage({ recentApdl: [{ apdl: "30343-1", name: "Project A" }] });
    const list = await getRecentList();
    expect(list).toEqual([{ apdl: "30343-1", name: "Project A" }]);
  });
});

describe("addToRecent", () => {
  it("adds new APDL to front of list", async () => {
    resetStorage({ recentApdl: [{ apdl: "11111-1", name: "Old" }] });
    const list = await addToRecent("22222-2", "New");
    expect(list[0]).toEqual({ apdl: "22222-2", name: "New" });
    expect(list[1]).toEqual({ apdl: "11111-1", name: "Old" });
  });

  it("moves existing APDL to front", async () => {
    resetStorage({
      recentApdl: [
        { apdl: "11111-1", name: "First" },
        { apdl: "22222-2", name: "Second" }
      ]
    });
    const list = await addToRecent("22222-2", "Updated");
    expect(list[0]).toEqual({ apdl: "22222-2", name: "Updated" });
    expect(list).toHaveLength(2);
  });

  it("trims list to MAX_RECENT", async () => {
    const existing = [];
    for (let i = 0; i < 10; i++) {
      existing.push({ apdl: i + "-0", name: "P" + i });
    }
    resetStorage({ recentApdl: existing });
    const list = await addToRecent("99999-9", "Overflow");
    expect(list).toHaveLength(10);
    expect(list[0].apdl).toBe("99999-9");
  });
});

describe("clearRecent", () => {
  it("empties the recent list in storage", async () => {
    resetStorage({ recentApdl: [{ apdl: "1-1", name: "X" }] });
    await clearRecent();
    expect(storageMock._data.recentApdl).toEqual([]);
  });
});

// =====================================================
//  Storage: getSavedUnitStatuses / saveUnitStatuses / clearNewlySold
// =====================================================

describe("getSavedUnitStatuses", () => {
  it("returns empty arrays when no saved data", async () => {
    resetStorage();
    const result = await getSavedUnitStatuses("30343-1");
    expect(result).toEqual({ previous: [], newlySold: [] });
  });

  it("returns saved statuses for given APDL", async () => {
    const statuses = [{ unitNumber: "A-1", status: "Telah Dijual" }];
    const newlySold = [{ unitNumber: "A-1", dateMarkedSold: "2024-01-01" }];
    resetStorage({
      unitStatuses: { "30343-1": statuses },
      newlySoldUnits: { "30343-1": newlySold }
    });
    const result = await getSavedUnitStatuses("30343-1");
    expect(result.previous).toEqual(statuses);
    expect(result.newlySold).toEqual(newlySold);
  });
});

describe("saveUnitStatuses", () => {
  it("saves statuses and newly sold for APDL", async () => {
    resetStorage();
    const statuses = [{ unitNumber: "B-1", status: "Belum Dijual" }];
    const newlySold = [];
    await saveUnitStatuses("30343-1", statuses, newlySold);
    expect(storageMock._data.unitStatuses["30343-1"]).toEqual(statuses);
    expect(storageMock._data.newlySoldUnits["30343-1"]).toEqual(newlySold);
  });
});

describe("clearNewlySold", () => {
  it("clears newly sold for specific APDL", async () => {
    resetStorage({
      newlySoldUnits: { "30343-1": [{ unitNumber: "A-1" }], "99999-0": [{ unitNumber: "B-1" }] }
    });
    await clearNewlySold("30343-1");
    expect(storageMock._data.newlySoldUnits["30343-1"]).toEqual([]);
    expect(storageMock._data.newlySoldUnits["99999-0"]).toEqual([{ unitNumber: "B-1" }]);
  });
});

// =====================================================
//  UI: showStatus / hideStatus
// =====================================================

describe("showStatus", () => {
  beforeEach(resetDOM);

  it("sets message text and class", () => {
    showStatus("Loading...", "loading");
    const el = document.getElementById("status-msg");
    expect(el.textContent).toBe("Loading...");
    expect(el.className).toBe("loading");
  });

  it("sets error class", () => {
    showStatus("Not found", "error");
    const el = document.getElementById("status-msg");
    expect(el.textContent).toBe("Not found");
    expect(el.className).toBe("error");
  });
});

describe("hideStatus", () => {
  beforeEach(resetDOM);

  it("clears message and class", () => {
    const el = document.getElementById("status-msg");
    el.textContent = "some message";
    el.className = "error";
    hideStatus();
    expect(el.textContent).toBe("");
    expect(el.className).toBe("");
  });
});

// =====================================================
//  UI: showProjectInfo / hideProjectInfo
// =====================================================

describe("showProjectInfo", () => {
  beforeEach(resetDOM);

  it("populates project details and counts", () => {
    const project = {
      nama: "Test Project",
      id: "30343-1",
      status: { keseluruhan: "Active" }
    };
    const counts = { totalUnits: 100, soldCount: 60, notSoldCount: 40 };
    showProjectInfo(project, counts, []);

    expect(document.getElementById("project-name").textContent).toBe("Test Project");
    expect(document.getElementById("project-code").textContent).toBe("30343-1");
    expect(document.getElementById("project-status").textContent).toBe("Active");
    expect(document.getElementById("total-units").textContent).toBe("100");
    expect(document.getElementById("sold-count").textContent).toBe("60");
    expect(document.getElementById("unsold-count").textContent).toBe("40");
    expect(document.getElementById("project-info").classList.contains("visible")).toBe(true);
  });

  it("uses projek.nama fallback", () => {
    const project = { projek: { nama: "Fallback Name" }, id: "1-1", status: {} };
    showProjectInfo(project, { totalUnits: 0, soldCount: 0, notSoldCount: 0 }, []);
    expect(document.getElementById("project-name").textContent).toBe("Fallback Name");
  });
});

describe("hideProjectInfo", () => {
  beforeEach(resetDOM);

  it("removes visible class", () => {
    const el = document.getElementById("project-info");
    el.classList.add("visible");
    hideProjectInfo();
    expect(el.classList.contains("visible")).toBe(false);
  });
});

// =====================================================
//  UI: renderRecentList
// =====================================================

describe("renderRecentList", () => {
  beforeEach(resetDOM);

  it("renders list items with APDL codes", () => {
    renderRecentList([
      { apdl: "30343-1", name: "Project A" },
      { apdl: "11111-1", name: "Project B" }
    ]);
    const items = document.querySelectorAll("#recent-list li");
    expect(items).toHaveLength(2);
    expect(items[0].querySelector(".recent-apdl").textContent).toBe("30343-1");
    expect(items[0].querySelector(".recent-name").textContent).toBe("Project A");
  });

  it("hides section when list is empty", () => {
    renderRecentList([]);
    expect(document.getElementById("recent-section").style.display).toBe("none");
  });

  it("shows section when list has items", () => {
    renderRecentList([{ apdl: "1-1", name: "X" }]);
    expect(document.getElementById("recent-section").style.display).not.toBe("none");
  });
});

// =====================================================
//  UI: renderNewlySold
// =====================================================

describe("renderNewlySold", () => {
  beforeEach(resetDOM);

  it("renders newly sold units with mark-read button", () => {
    renderNewlySold(
      [{ unitNumber: "A-1", dateMarkedSold: "2024-01-01" }],
      "30343-1"
    );
    const section = document.getElementById("newly-sold-section");
    expect(section.querySelector(".newly-sold")).not.toBeNull();
    expect(section.textContent).toContain("Newly sold: 1 unit(s)");
    expect(section.textContent).toContain("A-1");
    expect(document.getElementById("mark-read-btn")).not.toBeNull();
  });

  it("renders nothing for empty array", () => {
    renderNewlySold([], "30343-1");
    expect(document.getElementById("newly-sold-section").innerHTML).toBe("");
  });

  it("renders nothing for null", () => {
    renderNewlySold(null, "30343-1");
    expect(document.getElementById("newly-sold-section").innerHTML).toBe("");
  });
});

// =====================================================
//  validateApdl
// =====================================================

describe("validateApdl", () => {
  it("returns null for valid APDL codes", () => {
    expect(validateApdl("30343-1")).toBeNull();
    expect(validateApdl("1-2")).toBeNull();
    expect(validateApdl("123456-789")).toBeNull();
    expect(validateApdl("30343")).toBeNull();
  });

  it("returns error for empty or missing input", () => {
    expect(validateApdl("")).toBe("Please enter an APDL code.");
    expect(validateApdl(null)).toBe("Please enter an APDL code.");
    expect(validateApdl(undefined)).toBe("Please enter an APDL code.");
  });

  it("returns error for invalid format", () => {
    expect(validateApdl("abc")).toContain("Invalid APDL format");
    expect(validateApdl("abc-def")).toContain("Invalid APDL format");
    expect(validateApdl("123-")).toContain("Invalid APDL format");
    expect(validateApdl("-123")).toContain("Invalid APDL format");
  });
});

// =====================================================
//  lookupApdl (integration-style)
// =====================================================

describe("lookupApdl", () => {
  beforeEach(() => {
    resetDOM();
    resetStorage();
    global.fetch.mockReset();
  });

  it("fetches project + units and displays results", async () => {
    const project = { id: "30343-1", nama: "Test Project", status: { keseluruhan: "Active" } };
    const unitData = {
      unitGroups: [{
        jenis: "A",
        units: [
          { no: "A-1", statusJualan: "Telah Dijual" },
          { no: "A-2", statusJualan: "Belum Dijual" }
        ]
      }]
    };

    mockFetchJSON(project);
    mockFetchJSON(unitData);

    await lookupApdl("30343-1");

    expect(document.getElementById("project-name").textContent).toBe("Test Project");
    expect(document.getElementById("total-units").textContent).toBe("2");
    expect(document.getElementById("sold-count").textContent).toBe("1");
    expect(document.getElementById("unsold-count").textContent).toBe("1");
    expect(document.getElementById("status-msg").textContent).toBe("");
  });

  it("shows error on fetch failure", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    await lookupApdl("30343-1");

    expect(document.getElementById("status-msg").textContent).toBe("Network error");
    expect(document.getElementById("status-msg").className).toBe("error");
  });

  it("shows validation error for invalid APDL and does not fetch", async () => {
    await lookupApdl("bad-input!");

    expect(document.getElementById("status-msg").textContent).toContain("Invalid APDL format");
    expect(document.getElementById("status-msg").className).toBe("error");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
