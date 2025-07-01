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

      // Only add to cleaned list if the URL is unique
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        cleanedUrls.push(needsUpdate ? { url: cleanUrl, title: cleanTitle } : item);
        hasChanges = hasChanges || needsUpdate;
      } else {
        // skip duplicated URL
        hasChanges = true;
      }
    });

    if (hasChanges) {
      chrome.storage.local.set({ visitedUrls: cleanedUrls }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error cleaning up storage:", chrome.runtime.lastError);
        }
        if (typeof callback === 'function') {
          callback();
        }
      });
    } else {
      if (typeof callback === 'function') {
        callback();
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  cleanupInvalidStorageEntries(() => {
    // Load the list of visited URLs in the dropdown after cleanup
    loadVisitedUrls();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0].url;
    const correctUrlPattern = /^https:\/\/teduh\.kpkt\.gov\.my\/unit-project-swasta\/.*/;

    // Check if the user is on the correct URL
    if (correctUrlPattern.test(tabUrl)) {
      // unit counting script
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: countUnits
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const { totalUnits, soldCount, notSoldCount, unitStatuses } = results[0].result;
          const safeUrl = tabUrl.split('?')[0];
          
          // Get previous unit counts and statuses for this URL
          chrome.storage.local.get({ urlCounts: {}, unitStatuses: {}, newlySoldUnits: {} }, (data) => {
            const urlCounts = data.urlCounts || {};
            const previousCounts = urlCounts[safeUrl];
            const previousUnitStatuses = data.unitStatuses[safeUrl] || [];
            const newlySoldUnits = data.newlySoldUnits[safeUrl] || [];
            
            // Display current counts with previous counts in brackets if available
            document.getElementById("total-units").textContent = totalUnits + 
              (previousCounts ? ` (${previousCounts.totalUnits})` : '');
            document.getElementById("sold-count").textContent = soldCount + 
              (previousCounts ? ` (${previousCounts.soldCount})` : '');
            document.getElementById("not-sold-count").textContent = notSoldCount + 
              (previousCounts ? ` (${previousCounts.notSoldCount})` : '');
            
            // Detect newly sold units
            const currentlyNewlySold = detectNewlySoldUnits(unitStatuses, previousUnitStatuses, newlySoldUnits);
            
            // Save current counts and unit statuses
            urlCounts[safeUrl] = { totalUnits, soldCount, notSoldCount };
            const updatedUnitStatuses = { ...data.unitStatuses };
            updatedUnitStatuses[safeUrl] = unitStatuses;
            const updatedNewlySoldUnits = { ...data.newlySoldUnits };
            updatedNewlySoldUnits[safeUrl] = currentlyNewlySold;
            
            chrome.storage.local.set({ 
              urlCounts, 
              unitStatuses: updatedUnitStatuses,
              newlySoldUnits: updatedNewlySoldUnits
            }, () => {
              if (chrome.runtime.lastError) {
                console.error("Error saving data:", chrome.runtime.lastError);
              } else {
                // Apply highlighting to newly sold units
                if (currentlyNewlySold.length > 0) {
                  chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: highlightNewlySoldUnits,
                    args: [currentlyNewlySold]
                  });
                }
              }
            });
            
            // Update UI to show newly sold count and mark as read button
            updateNewlySoldUI(currentlyNewlySold, safeUrl, tabs[0].id);
          });
        } else {
          console.error("Failed to retrieve countUnits results.");
        }
      });

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: getTitle
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const title = results[0].result;

          // Extract the code from the URL (APDL - Advertising Permit and Developer’s License)
          const apdlMatch = tabUrl.match(/^https:\/\/teduh\.kpkt\.gov\.my\/unit-project-swasta\/([^\/]+)/);
          const apdl = apdlMatch ? apdlMatch[1].split('?')[0] : '';

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

function detectNewlySoldUnits(currentUnitStatuses, previousUnitStatuses, existingNewlySold) {
  const newlySoldUnits = [...existingNewlySold]; // Keep existing newly sold units
  
  // Create lookup map for previous statuses
  const previousStatusMap = {};
  previousUnitStatuses.forEach(unit => {
    previousStatusMap[unit.unitNumber] = unit.status;
  });
  
  // Check for newly sold units
  currentUnitStatuses.forEach(currentUnit => {
    const { unitNumber, status } = currentUnit;
    const previousStatus = previousStatusMap[unitNumber];
    
    // If unit was previously not sold (or unknown) and is now sold, mark as newly sold
    if (status === "Telah Dijual" && 
        previousStatus && 
        previousStatus !== "Telah Dijual" && 
        !newlySoldUnits.some(unit => unit.unitNumber === unitNumber)) {
      newlySoldUnits.push({
        unitNumber: unitNumber,
        dateMarkedSold: new Date().toISOString()
      });
    }
  });
  
  return newlySoldUnits;
}

function highlightNewlySoldUnits(newlySoldUnits) {
  // Remove any existing highlighting
  const existingHighlights = document.querySelectorAll('.newly-sold-highlight');
  existingHighlights.forEach(el => {
    el.classList.remove('newly-sold-highlight');
    el.style.removeProperty('background-color');
    el.style.removeProperty('color');
    el.style.removeProperty('border');
    el.style.removeProperty('border-radius');
    el.style.removeProperty('padding');
  });
  
  // Apply highlighting to newly sold units
  const unitBoxes = document.querySelectorAll("div.unit-box");
  const newlySoldNumbers = newlySoldUnits.map(unit => unit.unitNumber);
  
  unitBoxes.forEach((unit, index) => {
    const tooltipData = unit.getAttribute("data-tooltip");
    let unitNumber = null;
    
    if (tooltipData) {
      const tooltipObj = JSON.parse(tooltipData);
      unitNumber = tooltipObj["Unit Number"] || 
                   tooltipObj["No Unit"] || 
                   tooltipObj["Unit"] || 
                   tooltipObj["Nombor Unit"] ||
                   tooltipObj["No. Unit"] ||
                   `unit-${index + 1}`;
    } else {
      unitNumber = `unit-${index + 1}`;
    }
    
    if (newlySoldNumbers.includes(unitNumber)) {
      unit.classList.add('newly-sold-highlight');
      unit.style.backgroundColor = '#fff3cd'; // Mild yellow background
      unit.style.color = '#dc3545'; // Red text
      unit.style.border = '2px solid #ffc107'; // Yellow border
      unit.style.borderRadius = '4px';
      unit.style.padding = '2px';
    }
  });
}

function updateNewlySoldUI(newlySoldUnits, safeUrl, tabId) {
  const figuresDiv = document.getElementById("figures");
  
  // Remove existing newly sold UI if present
  const existingNewlySoldDiv = document.getElementById("newly-sold-section");
  if (existingNewlySoldDiv) {
    existingNewlySoldDiv.remove();
  }
  
  if (newlySoldUnits.length > 0) {
    const newlySoldDiv = document.createElement("div");
    newlySoldDiv.id = "newly-sold-section";
    newlySoldDiv.innerHTML = `
      <div style="margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 4px solid #dc3545;">
        <div style="font-weight: bold; color: #dc3545;">Newly Sold Units: ${newlySoldUnits.length}</div>
        <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">
          Units: ${newlySoldUnits.map(unit => unit.unitNumber).join(', ')}
        </div>
        <button id="mark-as-read-btn" style="margin-top: 8px; padding: 4px 8px; background-color: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">
          Mark as Read
        </button>
      </div>
    `;
    
    figuresDiv.appendChild(newlySoldDiv);
    
    // Add click handler for mark as read button
    document.getElementById("mark-as-read-btn").addEventListener("click", () => {
      markNewlySoldAsRead(safeUrl, tabId);
    });
  }
}

function markNewlySoldAsRead(safeUrl, tabId) {
  chrome.storage.local.get({ newlySoldUnits: {} }, (data) => {
    const newlySoldUnits = { ...data.newlySoldUnits };
    newlySoldUnits[safeUrl] = []; // Clear newly sold units for this URL
    
    chrome.storage.local.set({ newlySoldUnits }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error clearing newly sold units:", chrome.runtime.lastError);
      } else {
        // Remove highlighting from the page
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: clearNewlySoldHighlighting
        });
        
        // Update UI
        const newlySoldSection = document.getElementById("newly-sold-section");
        if (newlySoldSection) {
          newlySoldSection.remove();
        }
      }
    });
  });
}

function clearNewlySoldHighlighting() {
  const highlightedUnits = document.querySelectorAll('.newly-sold-highlight');
  highlightedUnits.forEach(unit => {
    unit.classList.remove('newly-sold-highlight');
    unit.style.removeProperty('background-color');
    unit.style.removeProperty('color');
    unit.style.removeProperty('border');
    unit.style.removeProperty('border-radius');
    unit.style.removeProperty('padding');
  });
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
  const unitStatuses = [];

  unitBoxes.forEach((unit, index) => {
    const tooltipData = unit.getAttribute("data-tooltip");
    let unitNumber = null;
    let status = null;
    
    if (tooltipData) {
      const tooltipObj = JSON.parse(tooltipData);
      status = tooltipObj["Status Jualan"];
      
      // Try to extract unit number from tooltip data
      // Common keys might be: "Unit Number", "No Unit", "Unit", "Nombor Unit"
      unitNumber = tooltipObj["Unit Number"] || 
                   tooltipObj["No Unit"] || 
                   tooltipObj["Unit"] || 
                   tooltipObj["Nombor Unit"] ||
                   tooltipObj["No. Unit"] ||
                   `unit-${index + 1}`; // fallback to index-based numbering
      
      if (status === "Telah Dijual") {
        soldCount++;
      } else if (status === "Belum Dijual") {
        notSoldCount++;
      }
      
      unitStatuses.push({
        unitNumber: unitNumber,
        status: status
      });
    } else {
      // Handle units without tooltip data
      unitStatuses.push({
        unitNumber: `unit-${index + 1}`,
        status: "Unknown"
      });
    }
  });

  const totalUnits = unitBoxes.length;
  return { totalUnits, soldCount, notSoldCount, unitStatuses };
}

if (typeof module !== "undefined") {
  module.exports = {
    countUnits,
    getTitle,
    linkGenerator,
    loadVisitedUrls,
    openSelectedUrl,
    cleanupInvalidStorageEntries,
    detectNewlySoldUnits,
    highlightNewlySoldUnits,
    updateNewlySoldUI,
    markNewlySoldAsRead,
    clearNewlySoldHighlighting
  };
}
