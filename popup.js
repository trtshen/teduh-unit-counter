// Function to check and cleanup invalid storage entries
function cleanupInvalidStorageEntries(callback) {
  chrome.storage.local.get({ visitedUrls: [] }, (data) => {
    const visitedUrls = data.visitedUrls || [];
    const cleanedUrls = [];
    const seenUrls = new Set();
    let hasChanges = false;

    // Process each entry to clean up invalid ones
    visitedUrls.forEach(item => {
      // Clean up URL by removing query params
      const cleanUrl = item.url.split('?')[0];

      // Check if title contains the APDL code with query parameters
      let cleanTitle = item.title;
      const titleMatch = item.title.match(/^(.*?)\s+\(([^)]+)\)$/);
      if (titleMatch) {
        const baseName = titleMatch[1];
        const apdlCode = titleMatch[2].split('?')[0]; // Remove query params from APDL
        cleanTitle = `${baseName} (${apdlCode})`;
      }

      // Check if we need to update this entry
      const needsUpdate = cleanUrl !== item.url || cleanTitle !== item.title;
      
      // Only add to cleaned list if we haven't seen this URL before
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        cleanedUrls.push(needsUpdate ? { url: cleanUrl, title: cleanTitle } : item);
        hasChanges = hasChanges || needsUpdate;
      } else {
        // Duplicate URL, skip it
        hasChanges = true;
      }
    });

    // Save changes if needed
    if (hasChanges) {
      chrome.storage.local.set({ visitedUrls: cleanedUrls }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error cleaning up storage:", chrome.runtime.lastError);
        }
        // Call the callback after saving changes
        if (typeof callback === 'function') {
          callback();
        }
      });
    } else {
      // Call the callback even if no changes were needed
      if (typeof callback === 'function') {
        callback();
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Clean up any invalid entries in storage first, then load visited URLs
  cleanupInvalidStorageEntries(() => {
    // Load the list of visited URLs in the dropdown after cleanup
    loadVisitedUrls();
  });
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0].url;
    const correctUrlPattern = /^https:\/\/teduh\.kpkt\.gov\.my\/unit-project-swasta\/.*/;

    // Check if the user is on the correct URL
    if (correctUrlPattern.test(tabUrl)) {
      // Run the unit counting script
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: countUnits
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const { totalUnits, soldCount, notSoldCount } = results[0].result;
          document.getElementById("total-units").textContent = totalUnits;
          document.getElementById("sold-count").textContent = soldCount;
          document.getElementById("not-sold-count").textContent = notSoldCount;
        } else {
          console.error("Failed to retrieve countUnits results.");
        }
      });

      // Get the title of the property
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: getTitle
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const title = results[0].result;

          // Extract the code from the URL (APDL - Advertising Permit and Developer’s License)
          const apdlMatch = tabUrl.match(/^https:\/\/teduh\.kpkt\.gov\.my\/unit-project-swasta\/([^\/]+)/);
          const apdl = apdlMatch ? apdlMatch[1].split('?')[0] : '';

          // Combine the title with the code
          const combinedTitle = `${title} (${apdl})`;

          // Add the current URL and combined title to the storage list if it's new
          chrome.storage.local.get({ visitedUrls: [] }, (data) => {
            const visitedUrls = data.visitedUrls || [];
            const safeUrl = tabUrl.split('?')[0];
            const urlExists = visitedUrls.some(item => item.url === safeUrl);
            if (!urlExists) {
              visitedUrls.push({ url: safeUrl, title: combinedTitle });
              chrome.storage.local.set({ visitedUrls }, () => {
                if (chrome.runtime.lastError) {
                  console.error("Error setting storage:", chrome.runtime.lastError);
                }
              });
            }
          });

          document.getElementById("project-title").textContent = combinedTitle;
        } else {
          console.error("Failed to retrieve title.");
        }
      });
    } else {
      // Display a message if the URL is incorrect
      const figuresSection = document.getElementById("figures");
      const messageContainer = `<div>
        <h3>Invalid URL</h3>
        <p>Please visit <a href="https://teduh.kpkt.gov.my/" target="_blank">https://teduh.kpkt.gov.my/</a> and find a property to use this extension.</p>
      </div>`;
      figuresSection.innerHTML = messageContainer;

      linkGenerator();
    }
  });

  // Add event listener to the dropdown for opening a new tab on change
  const dropdown = document.getElementById("visited-urls");
  if (dropdown) {
    dropdown.addEventListener("change", openSelectedUrl);
  }

});

function linkGenerator() {
  // HTML structure for APDL input and generate link button
  const apdlSection = `
    <input type="text" id="apdl-input" placeholder="Enter APDL code" />
    <button id="generate-link-button">Generate Link</button>
  `;
  document.getElementById('link-generator').innerHTML = apdlSection;

  // Add event listener to the APDL input field
  const apdlInput = document.getElementById("apdl-input");
  const generateLinkButton = document.getElementById("generate-link-button");
  if (apdlInput && generateLinkButton) {
    generateLinkButton.addEventListener("click", () => {
      const apdlCode = apdlInput.value.trim();
      if (apdlCode) {
        const generatedUrl = `https://teduh.kpkt.gov.my/unit-project-swasta/${apdlCode}`;
        chrome.tabs.create({ url: generatedUrl });
      }
    });
  }
}

function getTitle() {
  const el = document.querySelector('p.text-center.font-semibold.text-white');
  return el ? (el.textContent ?? '') : undefined;
}

function loadVisitedUrls() {
  chrome.storage.local.get({ visitedUrls: [] }, (data) => {
    const visitedUrls = data.visitedUrls || [];
    const dropdown = document.getElementById("visited-urls");

    if (dropdown === null) {
      return;
    }
    
    // Clear dropdown before populating to avoid duplicates
    while (dropdown.options.length > 1) { // Keep the first "Select a URL..." option
      dropdown.remove(1);
    }
    
    visitedUrls.forEach(item => {
      const option = document.createElement("option");
      option.value = item.url;
      option.textContent = item.title;
      dropdown.appendChild(option);
    });
  });
}

// Function to open the selected URL
function openSelectedUrl() {
  const dropdown = document.getElementById("visited-urls");
  const selectedUrl = dropdown.value;
  if (selectedUrl) {
    chrome.tabs.create({ url: selectedUrl });
  }
}

function countUnits() {
  const unitBoxes = document.querySelectorAll("div.unit-box");
  let soldCount = 0;
  let notSoldCount = 0;

  unitBoxes.forEach((unit) => {
    const tooltipData = unit.getAttribute("data-tooltip");
    if (tooltipData) {
      const tooltipObj = JSON.parse(tooltipData);
      const status = tooltipObj["Status Jualan"];
      if (status === "Telah Dijual") {
        soldCount++;
      } else if (status === "Belum Dijual") {
        notSoldCount++;
      }
    }
  });

  const totalUnits = unitBoxes.length;
  return { totalUnits, soldCount, notSoldCount };
}

// export functions for testing
if (typeof module !== "undefined") {
  module.exports = {
    countUnits,
    getTitle,
    linkGenerator,
    loadVisitedUrls,
    openSelectedUrl,
    cleanupInvalidStorageEntries
  };
}
