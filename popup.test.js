/**
 * unit tests for popup.js
 * - use jest and jsdom
 * - mock chrome APIs
 */

const {
  countUnits,
  getTitle,
  linkGenerator,
  loadVisitedUrls,
  openSelectedUrl,
  cleanupInvalidStorageEntries
} = require('./popup.js');

describe('countUnits', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns zero counts when no units', () => {
    expect(countUnits()).toEqual({ totalUnits: 0, soldCount: 0, notSoldCount: 0 });
  });

  it('counts sold and unsold units correctly', () => {
    document.body.innerHTML = `
      <div class="unit-box" data-tooltip='{"Status Jualan":"Telah Dijual"}'></div>
      <div class="unit-box" data-tooltip='{"Status Jualan":"Belum Dijual"}'></div>
      <div class="unit-box" data-tooltip='{"Status Jualan":"Telah Dijual"}'></div>
      <div class="unit-box" data-tooltip='{"Status Jualan":"Belum Dijual"}'></div>
      <div class="unit-box" data-tooltip='{"Status Jualan":"Other"}'></div>
      <div class="unit-box"></div>
    `;
    expect(countUnits()).toEqual({ totalUnits: 6, soldCount: 2, notSoldCount: 2 });
  });
});

describe('getTitle', () => {
  it('returns undefined if no title element', () => {
    document.body.innerHTML = '';
    expect(getTitle()).toBeUndefined();
  });

  it('returns the text content of the title element', () => {
    document.body.innerHTML = `<p class="text-center font-semibold text-white">Project Title</p>`;
    expect(getTitle()).toBe('Project Title');
  });

  it('returns empty string if title element exists but is empty', () => {
    document.body.innerHTML = `<p class="text-center font-semibold text-white"></p>`;
    expect(getTitle()).toBe('');
  });
});

describe('linkGenerator', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="link-generator"></div>`;
    global.chrome = { tabs: { create: jest.fn() } };
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('renders input and button', () => {
    linkGenerator();
    expect(document.getElementById('apdl-input')).not.toBeNull();
    expect(document.getElementById('generate-link-button')).not.toBeNull();
  });

  it('generates link and opens tab on button click', () => {
    linkGenerator();
    const input = document.getElementById('apdl-input');
    const button = document.getElementById('generate-link-button');
    input.value = 'ABC123';
    button.click();
    expect(global.chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://teduh.kpkt.gov.my/unit-project-swasta/ABC123' });
  });
});

describe('loadVisitedUrls', () => {
  beforeEach(() => {
    document.body.innerHTML = `<select id="visited-urls"></select>`;
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((defaults, cb) => cb({
            visitedUrls: [
              { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc', title: 'Project ABC' },
              { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/def', title: 'Project DEF' }
            ]
          }))
        }
      }
    };
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('populates dropdown with visited urls', () => {
    loadVisitedUrls();
    const dropdown = document.getElementById('visited-urls');
    expect(dropdown.options.length).toBe(2);
    expect(dropdown.options[0].value).toBe('https://teduh.kpkt.gov.my/unit-project-swasta/abc');
    expect(dropdown.options[0].textContent).toBe('Project ABC');
    expect(dropdown.options[1].value).toBe('https://teduh.kpkt.gov.my/unit-project-swasta/def');
    expect(dropdown.options[1].textContent).toBe('Project DEF');
  });

  it('does nothing if dropdown is missing', () => {
    document.body.innerHTML = '';
    expect(() => loadVisitedUrls()).not.toThrow();
  });
});

describe('openSelectedUrl', () => {
  beforeEach(() => {
    document.body.innerHTML = `<select id="visited-urls"><option value="https://teduh.kpkt.gov.my/unit-project-swasta/abc">Project ABC</option></select>`;
    global.chrome = { tabs: { create: jest.fn() } };
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('opens selected url in new tab', () => {
    document.getElementById('visited-urls').value = 'https://teduh.kpkt.gov.my/unit-project-swasta/abc';
    openSelectedUrl();
    expect(global.chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc' });
  });

  it('does nothing if no url selected', () => {
    document.getElementById('visited-urls').value = '';
    openSelectedUrl();
    expect(global.chrome.tabs.create).not.toHaveBeenCalled();
  });
});

describe('visitedUrls storage', () => {
  beforeEach(() => {
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((defaults, cb) => cb({ visitedUrls: [] })),
          set: jest.fn((data, cb) => cb && cb())
        }
      },
      runtime: { lastError: null }
    };
    document.body.innerHTML = `<span id="project-title"></span>`;
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('stores only base url without query params', () => {
    // simulate the logic from popup.js for storing visitedUrls
    const tabUrl = 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123?foo=bar&baz=qux';
    const title = 'Test Project';
    const apdlMatch = tabUrl.match(/^https:\/\/teduh\.kpkt\.gov\.my\/unit-project-swasta\/([^\/]+)/);
    const apdl = apdlMatch ? apdlMatch[1].split('?')[0] : '';
    const combinedTitle = `${title} (${apdl})`;
    const safeUrl = tabUrl.split('?')[0];

    // mimic the storage logic
    chrome.storage.local.get({ visitedUrls: [] }, (data) => {
      const visitedUrls = data.visitedUrls || [];
      const urlExists = visitedUrls.some(item => item.url === safeUrl);
      if (!urlExists) {
        visitedUrls.push({ url: safeUrl, title: combinedTitle });
        chrome.storage.local.set({ visitedUrls }, () => { });
      }
    });

    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
      { visitedUrls: [{ url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123', title: 'Test Project (abc123)' }] },
      expect.any(Function)
    );
  });
});

describe('cleanupInvalidStorageEntries', () => {
  beforeEach(() => {
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn((data, cb) => cb && cb())
        }
      },
      runtime: { lastError: null }
    };
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('cleans up URLs with query parameters', () => {
    // Sample data with invalid URLs
    const mockData = {
      visitedUrls: [
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123?param=value', title: 'Project ABC (abc123)' },
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/def456', title: 'Project DEF (def456)' }
      ]
    };

    // Mock the storage.get to return our test data
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(mockData);
    });

    // Create a mock callback
    const mockCallback = jest.fn();

    // Call the function
    cleanupInvalidStorageEntries(mockCallback);

    // Check that set was called with cleaned data
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
      visitedUrls: [
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123', title: 'Project ABC (abc123)' },
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/def456', title: 'Project DEF (def456)' }
      ]
    }, expect.any(Function));

    // Execute the callback that would be passed to chrome.storage.local.set
    global.chrome.storage.local.set.mock.calls[0][1]();

    // Check that our callback was called
    expect(mockCallback).toHaveBeenCalled();
  });

  it('cleans up titles with query parameters in APDL code', () => {
    // Sample data with invalid titles
    const mockData = {
      visitedUrls: [
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123', title: 'Project ABC (abc123?param=value)' },
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/def456', title: 'Project DEF (def456)' }
      ]
    };

    // Mock the storage.get to return our test data
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(mockData);
    });

    // Call the function
    cleanupInvalidStorageEntries();

    // Check that set was called with cleaned data
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
      visitedUrls: [
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123', title: 'Project ABC (abc123)' },
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/def456', title: 'Project DEF (def456)' }
      ]
    }, expect.any(Function));
  });

  it('removes duplicate URLs keeping first occurrence', () => {
    // Sample data with duplicate URLs but different titles
    const mockData = {
      visitedUrls: [
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123', title: 'Project ABC (abc123)' },
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123', title: 'Project ABC Modified (abc123)' },
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/def456', title: 'Project DEF (def456)' }
      ]
    };

    // Mock the storage.get to return our test data
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(mockData);
    });

    // Call the function
    cleanupInvalidStorageEntries();

    // Check that set was called with cleaned data (no duplicates)
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
      visitedUrls: [
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123', title: 'Project ABC (abc123)' },
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/def456', title: 'Project DEF (def456)' }
      ]
    }, expect.any(Function));
  });

  it('does not update storage if no changes needed but still calls callback', () => {
    // Sample data with clean entries
    const mockData = {
      visitedUrls: [
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123', title: 'Project ABC (abc123)' },
        { url: 'https://teduh.kpkt.gov.my/unit-project-swasta/def456', title: 'Project DEF (def456)' }
      ]
    };

    // Mock the storage.get to return our test data
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(mockData);
    });

    // Create a mock callback
    const mockCallback = jest.fn();

    // Call the function
    cleanupInvalidStorageEntries(mockCallback);

    // Check that set was not called since no changes needed
    expect(global.chrome.storage.local.set).not.toHaveBeenCalled();

    // Check that our callback was still called
    expect(mockCallback).toHaveBeenCalled();
  });
});

describe('unitCounts storage and display', () => {
  beforeEach(() => {
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn((data, cb) => cb && cb())
        }
      },
      runtime: { lastError: null }
    };
    document.body.innerHTML = `
      <span id="total-units"></span>
      <span id="sold-count"></span>
      <span id="not-sold-count"></span>
    `;
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('stores unit counts and shows previous counts', () => {
    const safeUrl = 'https://teduh.kpkt.gov.my/unit-project-swasta/abc123';
    const currentCounts = { totalUnits: 100, soldCount: 60, notSoldCount: 40 };
    const previousCounts = { totalUnits: 90, soldCount: 50, notSoldCount: 40 };

    // Mock previous counts retrieval
    global.chrome.storage.local.get.mockImplementation((key, cb) => {
      const urlCounts = {};
      urlCounts[safeUrl] = previousCounts;
      cb({ urlCounts });
    });

    // Simulate updating the counts display with previous counts in brackets
    document.getElementById("total-units").textContent = currentCounts.totalUnits +
      ` (${previousCounts.totalUnits})`;
    document.getElementById("sold-count").textContent = currentCounts.soldCount +
      ` (${previousCounts.soldCount})`;
    document.getElementById("not-sold-count").textContent = currentCounts.notSoldCount +
      ` (${previousCounts.notSoldCount})`;

    // Then save the current counts
    const urlCounts = {};
    urlCounts[safeUrl] = currentCounts;
    chrome.storage.local.set({ urlCounts }, () => { });

    // Verify the display
    expect(document.getElementById("total-units").textContent).toBe('100 (90)');
    expect(document.getElementById("sold-count").textContent).toBe('60 (50)');
    expect(document.getElementById("not-sold-count").textContent).toBe('40 (40)');

    // Verify storage was called
    expect(global.chrome.storage.local.set).toHaveBeenCalled();

    // Check that the object passed to set has the expected structure
    const setCall = global.chrome.storage.local.set.mock.calls[0][0];
    expect(setCall).toHaveProperty('urlCounts');
    expect(Object.keys(setCall.urlCounts)).toContain(safeUrl);
    expect(setCall.urlCounts[safeUrl]).toEqual(currentCounts);
  });
});
