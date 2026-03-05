// === Constants ===
const API_BASE = "https://teduh.kpkt.gov.my/api";
const TEDUH_SEARCH_URL = "https://teduh.kpkt.gov.my/semakan-status-kemajuan";
const MAX_RECENT = 10;
const APDL_PATTERN = /^\d+-\d+$/;

// === API ===

async function fetchProjectDetails(apdl) {
  const res = await fetch(`${API_BASE}/projek-swasta/${encodeURIComponent(apdl)}`, {
    headers: { "Accept": "application/json" },
    credentials: "include"
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Project not found");
    throw new Error(`API error (${res.status})`);
  }
  return res.json();
}

async function fetchUnitList(apdl) {
  const res = await fetch(`${API_BASE}/unit-projek-swasta/${encodeURIComponent(apdl)}`, {
    headers: { "Accept": "application/json" },
    credentials: "include"
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Unit data not found");
    throw new Error(`API error (${res.status})`);
  }
  return res.json();
}

// === Unit counting ===

function countUnitsFromApi(unitData) {
  const unitStatuses = [];
  let soldCount = 0;
  let notSoldCount = 0;

  for (const group of (unitData.unitGroups || [])) {
    for (const unit of (group.units || [])) {
      const status = unit.statusJualan || "Unknown";
      unitStatuses.push({ unitNumber: unit.no, status });
      if (status === "Telah Dijual") soldCount++;
      else if (status === "Belum Dijual") notSoldCount++;
    }
  }

  return {
    totalUnits: unitStatuses.length,
    soldCount,
    notSoldCount,
    unitStatuses
  };
}

function detectNewlySoldUnits(currentStatuses, previousStatuses, existingNewlySold) {
  const newlySoldUnits = [...existingNewlySold];
  const previousMap = {};
  for (const unit of previousStatuses) {
    previousMap[unit.unitNumber] = unit.status;
  }

  for (const current of currentStatuses) {
    const prev = previousMap[current.unitNumber];
    if (
      current.status === "Telah Dijual" &&
      prev && prev !== "Telah Dijual" &&
      !newlySoldUnits.some(u => u.unitNumber === current.unitNumber)
    ) {
      newlySoldUnits.push({
        unitNumber: current.unitNumber,
        dateMarkedSold: new Date().toISOString()
      });
    }
  }

  return newlySoldUnits;
}

// === Storage helpers ===

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

async function getRecentList() {
  const data = await storageGet({ recentApdl: [] });
  return data.recentApdl || [];
}

async function addToRecent(apdl, projectName) {
  const list = await getRecentList();
  const filtered = list.filter(item => item.apdl !== apdl);
  filtered.unshift({ apdl, name: projectName });
  const trimmed = filtered.slice(0, MAX_RECENT);
  await storageSet({ recentApdl: trimmed });
  return trimmed;
}

async function clearRecent() {
  await storageSet({ recentApdl: [] });
}

async function getSavedUnitStatuses(apdl) {
  const data = await storageGet({ unitStatuses: {}, newlySoldUnits: {} });
  return {
    previous: (data.unitStatuses || {})[apdl] || [],
    newlySold: (data.newlySoldUnits || {})[apdl] || []
  };
}

async function saveUnitStatuses(apdl, currentStatuses, newlySoldUnits) {
  const data = await storageGet({ unitStatuses: {}, newlySoldUnits: {} });
  const statuses = { ...(data.unitStatuses || {}), [apdl]: currentStatuses };
  const newlySold = { ...(data.newlySoldUnits || {}), [apdl]: newlySoldUnits };
  await storageSet({ unitStatuses: statuses, newlySoldUnits: newlySold });
}

async function clearNewlySold(apdl) {
  const data = await storageGet({ newlySoldUnits: {} });
  const newlySold = { ...(data.newlySoldUnits || {}), [apdl]: [] };
  await storageSet({ newlySoldUnits: newlySold });
}

// === UI ===

function showStatus(msg, type) {
  const el = document.getElementById("status-msg");
  if (!el) return;
  el.textContent = msg;
  el.className = type;
}

function hideStatus() {
  const el = document.getElementById("status-msg");
  if (!el) return;
  el.textContent = "";
  el.className = "";
}

function showProjectInfo(project, counts, newlySoldUnits) {
  const container = document.getElementById("project-info");
  if (!container) return;
  container.classList.add("visible");

  const nameEl = document.getElementById("project-name");
  if (nameEl) nameEl.textContent = project.nama || project.projek?.nama || "";

  const codeEl = document.getElementById("project-code");
  if (codeEl) codeEl.textContent = project.id || "";

  const statusEl = document.getElementById("project-status");
  if (statusEl) statusEl.textContent = project.status?.keseluruhan || "";

  const linkEl = document.getElementById("teduh-link");
  if (linkEl) {
    linkEl.href = `${TEDUH_SEARCH_URL}?q=${encodeURIComponent(project.id || "")}`;
  }

  const totalEl = document.getElementById("total-units");
  if (totalEl) totalEl.textContent = counts.totalUnits;

  const soldEl = document.getElementById("sold-count");
  if (soldEl) soldEl.textContent = counts.soldCount;

  const unsoldEl = document.getElementById("unsold-count");
  if (unsoldEl) unsoldEl.textContent = counts.notSoldCount;

  renderNewlySold(newlySoldUnits, project.id);
}

function hideProjectInfo() {
  const container = document.getElementById("project-info");
  if (!container) return;
  container.classList.remove("visible");
}

function renderNewlySold(newlySoldUnits, apdl) {
  const section = document.getElementById("newly-sold-section");
  if (!section) return;
  section.innerHTML = "";

  if (!newlySoldUnits || newlySoldUnits.length === 0) return;

  const unitNames = newlySoldUnits.map(u => u.unitNumber).join(", ");
  const div = document.createElement("div");
  div.className = "newly-sold";
  div.innerHTML =
    `<strong>Newly sold: ${newlySoldUnits.length} unit(s)</strong>` +
    `<div class="unit-list">${unitNames}</div>` +
    `<button id="mark-read-btn">Mark as read</button>`;
  section.appendChild(div);

  const btn = document.getElementById("mark-read-btn");
  if (btn) {
    btn.addEventListener("click", async () => {
      await clearNewlySold(apdl);
      section.innerHTML = "";
    });
  }
}

function renderRecentList(list) {
  const ul = document.getElementById("recent-list");
  const section = document.getElementById("recent-section");
  if (!ul || !section) return;

  ul.innerHTML = "";
  if (list.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";

  for (const item of list) {
    const li = document.createElement("li");
    const apdlSpan = document.createElement("span");
    apdlSpan.className = "recent-apdl";
    apdlSpan.textContent = item.apdl;
    apdlSpan.addEventListener("click", () => {
      const input = document.getElementById("apdl-input");
      if (input) input.value = item.apdl;
      lookupApdl(item.apdl);
    });

    const nameSpan = document.createElement("span");
    nameSpan.className = "recent-name";
    nameSpan.textContent = item.name || "";

    li.appendChild(apdlSpan);
    li.appendChild(nameSpan);
    ul.appendChild(li);
  }
}

// === Core lookup ===

async function lookupApdl(apdl) {
  hideProjectInfo();
  showStatus("Loading\u2026", "loading");

  try {
    const [project, unitData] = await Promise.all([
      fetchProjectDetails(apdl),
      fetchUnitList(apdl)
    ]);

    const counts = countUnitsFromApi(unitData);

    // Detect newly sold
    const saved = await getSavedUnitStatuses(apdl);
    const newlySold = detectNewlySoldUnits(
      counts.unitStatuses,
      saved.previous,
      saved.newlySold
    );

    // Persist
    await saveUnitStatuses(apdl, counts.unitStatuses, newlySold);
    const recentList = await addToRecent(apdl, project.nama || "");

    hideStatus();
    showProjectInfo(project, counts, newlySold);
    renderRecentList(recentList);
  } catch (err) {
    showStatus(err.message || "Failed to load project", "error");
  }
}

// === Init ===

function initPopup() {
  const input = document.getElementById("apdl-input");
  const openBtn = document.getElementById("open-btn");
  const clearBtn = document.getElementById("clear-recent");

  if (openBtn && input) {
    const handleOpen = () => {
      const apdl = input.value.trim();
      if (!apdl) return;
      lookupApdl(apdl);
    };

    openBtn.addEventListener("click", handleOpen);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleOpen();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      await clearRecent();
      renderRecentList([]);
    });
  }

  // Load recent list on open
  getRecentList().then(renderRecentList);
}

document.addEventListener("DOMContentLoaded", initPopup);

// === Exports for testing ===
if (typeof module !== "undefined") {
  module.exports = {
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
    lookupApdl,
    initPopup,
    APDL_PATTERN,
    API_BASE,
    MAX_RECENT
  };
}
