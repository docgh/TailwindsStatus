// maint.js
import $ from "jquery";

function getURL(suffix) {
  const host = window.location.hostname;
  if (host === "192.168.0.2") {
    return "http://192.168.0.2:5174/api/" + suffix;
  } else {
    return "./api/" + suffix;
  }
}

async function fetchMaintData() {
  const response = await fetch(getURL("maint"));
  if (!response.ok) throw new Error("Failed to fetch maintenance data");
  return response.json();
}

function renderMaintPage() {
  $(document.body).empty();
  const mainDiv = $("<div class='maint-main'>");
  mainDiv.append($("<h1>").text("Aircraft Maintenance & Squawks"));
  fetchMaintData().then(data => {
    if (!Array.isArray(data) || data.length === 0) {
      mainDiv.append($("<div>").text("No aircraft maintenance data available."));
      $(document.body).append(mainDiv);
      return;
    }
    data.forEach(ac => {
      const acDiv = $("<div class='aircraft-maint'>").css({
        border: "1px solid #ccc",
        borderRadius: "1em",
        margin: "1em 0",
        padding: "1em",
        background: "#f9f9f9"
      });
      acDiv.append($("<h2>").text(ac.name || ac.registrationTail || ac.tailNumber || "Aircraft"));
      if (ac.grounded) {
        acDiv.append($("<div>").text("Status: Grounded").css({ color: "red", fontWeight: "bold" }));
      }
            // Squawks
      acDiv.append($("<h3>").text("Squawks"));
      if (Array.isArray(ac.squawks) && ac.squawks.length > 0) {
        const squawkList = $("<ul>");
        ac.squawks.forEach(sq => {
          const li = $("<li>");
          li.text(sq.title || sq.description || JSON.stringify(sq));
          if (sq.groundAircraft) {
            li.addClass("grounded");
          }
          squawkList.append(li);
        });
        acDiv.append(squawkList);
      } else {
        acDiv.append($("<div>").text("No unresolved squawks."));
      }
      // Maintenance Items
      acDiv.append($("<h3>").text("Maintenance Reminders"));
      if (Array.isArray(ac.maintenance) && ac.maintenance.length > 0) {
        const maintList = $("<ul>");
        ac.maintenance.forEach(item => {
          const li = $("<li>");
          li.text(item.name || item.description || JSON.stringify(item));
          if (item.dateOptions && item.dateOptions.message) {
            li.append($("<span>").text(" (" + item.dateOptions.message + ")").css({ fontStyle: "italic", color: "#888" }));
          }
          if (item.timeOptions && item.timeOptions.message) {
            li.append($("<span>").text(" (" + item.timeOptions.message + ")").css({ fontStyle: "italic", color: "#888" }));
          }
          maintList.append(li);
        });
        acDiv.append(maintList);
      } else {
        acDiv.append($("<div>").text("No active maintenance reminders."));
      }

      mainDiv.append(acDiv);
    });
    $(document.body).append(mainDiv);
  }).catch(err => {
    mainDiv.append($("<div>").text("Error loading maintenance data: " + err.message));
    $(document.body).append(mainDiv);
  });
}

$(document).ready(renderMaintPage);
