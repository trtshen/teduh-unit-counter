document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0].url;
    const correctUrlPattern = /^https:\/\/teduh\.kpkt\.gov\.my\/unit-project-swasta\/.*/;

    // Check if the user is on the correct URL
    if (correctUrlPattern.test(tabUrl)) {
      // Add the current URL to the storage list if it's new
      chrome.storage.local.get({ visitedUrls: [] }, (data) => {
        const visitedUrls = data.visitedUrls || [];
        if (!visitedUrls.includes(tabUrl)) {
          visitedUrls.push(tabUrl);
          chrome.storage.local.set({ visitedUrls }, () => {
            if (chrome.runtime.lastError) {
              console.error("Error setting storage:", chrome.runtime.lastError);
            }
          });
        }
      });

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
    } else {
      // Display a message if the URL is incorrect
      document.body.innerHTML = `
        <h3>Invalid URL</h3>
        <p>Please visit <a href="https://teduh.kpkt.gov.my/project-swasta/" target="_blank">https://teduh.kpkt.gov.my/project-swasta/</a> and find a property to use this extension.</p>
      `;
    }

    // Load the list of visited URLs in the dropdown
    loadVisitedUrls();
  });
});

// Function to load visited URLs into the dropdown
function loadVisitedUrls() {
  chrome.storage.local.get({ visitedUrls: [] }, (data) => {
    const visitedUrls = data.visitedUrls || [];
    const dropdown = document.getElementById("visited-urls");

    if (dropdown === null) {
      return;
    }
    
    visitedUrls.forEach(url => {
      const option = document.createElement("option");
      option.value = url;
      option.textContent = url;
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