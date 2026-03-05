# todo list (v2)

## Done
- [x] rewrite to API-first approach (no content scripts / DOM scraping)
- [x] fetch project details and unit list from public REST APIs
- [x] count sold / unsold units from API response
- [x] detect newly sold units between visits
- [x] recent APDL lookup history (max 10)
- [x] declarativeNetRequest rules for legacy URL redirects
- [x] full Jest test suite (43 tests)
- [x] async/await with promise wrappers for chrome.storage
- [x] extract constants (API_BASE, APDL_PATTERN, MAX_RECENT)

## To Do
- [ ] validate APDL input format before making API call (show user feedback)
- [ ] add search-by-keyword feature (API supports `?q=keyword&search_type=projek`)
- [ ] offline fallback — display last-known data when API is unreachable
- [ ] support i18n/localization (Malay / English)
- [ ] add loading spinner or skeleton UI during API fetch
- [ ] publish to Chrome Web Store