
document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: countSoldUnits
    }, (results) => {
      document.getElementById("count").textContent = results[0].result;
    });
  });
});

function countSoldUnits() {
  // Select all `unit-box` elements and parse the `data-tooltip`
  const unitBoxes = document.querySelectorAll("div.unit-box");
  let soldCount = 0;

  unitBoxes.forEach((unit) => {
    const tooltipData = unit.getAttribute("data-tooltip");
    if (tooltipData) {
      const tooltipObj = JSON.parse(tooltipData);
      if (tooltipObj["Status Jualan"] === "Telah Dijual") {
        soldCount++;
      }
    }
  });

  return soldCount;
}
