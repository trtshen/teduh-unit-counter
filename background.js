// Service worker for TEDUH APDL Fast Access
// Handles legacy URL redirects (declarativeNetRequest handles the static rules)
// This file is intentionally minimal — the DNR rules in rules.json handle redirects.

chrome.runtime.onInstalled.addListener(() => {
  console.log("TEDUH APDL Fast Access installed/updated");
});
