import $, { data } from "jquery";
import "./App.css";
import runwayImg from "./assets/runway.png";
import arrowImg from "./assets/arrow.png";
import fromLeft from "./assets/frmLeft.png";
import fromRight from "./assets/frmRight.png";
import logo from "./assets/logo.png";
import AircraftStatusDiv from "./AircraftStatusDiv";


const isMobile = window.screen.width < 800;

function setZoom() {
  if (window.matchMedia('(min-width: 300px) and (max-width: 1600px)').matches) {
    document.body.style.zoom = "70%";
  } else {
    document.body.style.zoom = "100%";
  }
}

setZoom();

function getURL(suffix) {
  const host = window.location.hostname;
  if (host === "192.168.0.2") {
    return "http://192.168.0.2:5174/api/" + suffix;
  } else {
    return "./api/" + suffix;
  }
}

// Fetch weather data from the backend API
async function fetchWeatherData() {
  const response = await fetch(getURL("weather"));
  //const response = await fetch("./api/weather");
  if (!response.ok) throw new Error("Failed to fetch weather data");
  return response.json();
}

async function fetchAircraftData() {
  const response = await fetch(getURL("aircraft"));
  //const response = await fetch("./api/aircraft");
  if (!response.ok) throw new Error("Failed to fetch aircraft data");
  return response.json();
}

function getImage(crosswind) {
  if (crosswind === 0) {
    return;
  }
  return $("<img>")
    .attr("src", crosswind > 0 ? fromRight : fromLeft)
    .addClass("windDirImg");
}

function disp(val) {
  if (val < 0) return val * -1;
  return val;
}

function Runway(runway, weather) {
  const rw = $("<div>").addClass("runwayDiv");
  if (!isMobile) rw.css("margin-left", "20px");
  const dataDiv = $("<div>").addClass("runwayData");
  dataDiv.append($("<h2>").text("Runway " + runway.runway));
  dataDiv.append(
    $("<p>").text(
      "Headwind: " + runway.headwind + " G" + runway.gust_headwind + " knots"
    )
  );
  dataDiv.append(
    $("<p>").append(
      $("<span>")
        .append("Crosswind: ")
        .append(getImage(runway.crosswind))
        .append(
          disp(runway.crosswind) + " G" + disp(runway.gust_crosswind) + " knots"
        )
    )
  );
  dataDiv.append(
    $("<div>").append(
      StatusBoxes(
        [
          { label: "Solo", color: runway.student },
          { label: "VFR", color: runway.vfr },
          { label: "IFR", color: runway.ifr },
        ],
        "20px"
      )
    )
  );
  rw.append(dataDiv);
  if (isMobile) rw.append(clear());
  const imageDiv = $("<div>").addClass("rwImg");
  imageDiv.append(
    $("<img>")
      .attr("src", runwayImg)
      .attr("alt", runwayImg)
      .css("position", "absolute")
      .css("width", "200px")
      .css("height", "auto")
      .css("transform", "rotate(" + runway.runway * 10 + "deg)")
  );
  imageDiv.append(
    $("<img>")
      .attr("src", arrowImg)
      .css("width", "200px")
      .css("position", "absolute")
      .css("left", "0px")
      .css("top", "0px")
      .css("height", "auto")
      .css("transform", "rotate(" + weather.dir + "deg)")
  );
  rw.append(imageDiv);
  return rw;
}

function clear() {
  return $("<div>").addClass("clear");
}

function WeatherDiv(weather) {
  const div = $("<div>").addClass("weatherDiv");
  div.append($("<h2>").text("Weather Data"));
  div.append($('<div class="date-span">').text(new Date().toTimeString()));
  div.append("<br>");
  div.append(
    $('<span class="wd">').text(
      "Wind Speed: " + (weather.speed ?? "N/A") + " kt"
    )
  );
  div.append(
    $('<span class="wd">').text(
      "Wind Direction: " + (weather.dir ?? "N/A") + "°"
    )
  );
  div.append(
    $('<span class="wd">').text(
      "Wind Gusts: " + (weather.gust ?? "N/A") + " kt"
    )
  );
  if (weather.weather) {
    div.append(
      $('<span class="wd">').text("Weather: " + (weather.weather ?? "N/A"))
    );
  }
  if (Array.isArray(weather.clouds) && weather.clouds.length > 0) {
    const cloudsList = $("<ul>");
    weather.clouds.forEach((cloud) => {
      cloudsList.append(
        $("<li>").text(cloud.coverage + " at " + cloud.base + " ft")
      );
    });
    div.append($("<p>").text("Cloud Bases:"));
    div.append(cloudsList);
  } else {
    div.append($("<p>").text("Cloud Bases: N/A"));
  }
  return div;
}

function statusDiv(runways, allRed) {
  let student = "red",
    vfr = "red",
    ifr = "red";
  if (!allRed) {
    runways.forEach((rw) => {
      if (rw.student === "green") student = "green";
      if (rw.vfr === "green") vfr = "green";
      if (rw.ifr === "green") ifr = "green";
      if (rw.student === "yellow" && student !== "green") student = "yellow";
      if (rw.vfr === "yellow" && vfr !== "green") vfr = "yellow";
      if (rw.ifr === "yellow" && ifr !== "green") ifr = "yellow";
    });
  }
  return $('<div class="statusDiv">').append(
    StatusBoxes(
      [
        { label: "Solo", color: student },
        { label: "VFR", color: vfr },
        { label: "IFR", color: ifr },
      ],
      "20px"
    )
  );
}



function setRunways(node, data) {
    if (!data.weather.speed || !data.weather.dir) { // If weather data is not available, return an empty div
    node.append($("<div>").addClass("runwayDiv").text("Winds calm"));
    return;
  }
  if (data.weather.dir === 'VRB') {
    node.append($("<div>").addClass("runwayDiv").text("Winds variable"));
    return;
  }
  data.runways.forEach((rw) => {
    const newRw = Runway(rw, data.weather);
    node.append(newRw);
  });
}

function StatusBoxes(statuses, size) {
  // statuses: array of { label,  color } where color is 'green', 'yellow', or 'red'
  const container = $("<div>")
    .addClass("statusBoxesContainer")
    .css({ display: "flex", gap: "1em", margin: "1em 0" });
  statuses.forEach(({ label, color }) => {
    const box = $("<div>")
      .addClass("statusBox")
      .css({
        background: color,
        color: color === "yellow" ? "#333" : "#ddd",
        padding: "1em 2em",
        borderRadius: "1em",
        width: size,
        height: size,
        textAlign: "center",
        fontWeight: "bold",
        fontSize: "1.2em",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      });
    box.append($("<div class='label'>").text(label));
    container.append(box);
  });
  return container;
}

function getTafDiv(taf) {
  const container = $("<div>").addClass("tafDiv");
  container.append($("<h2>").text("TAF Forecast" + (taf.station ? " for " + taf.station : "") + (taf.until ? " until " + taf.until : "")));
  if (!taf || !taf.periods || taf.periods.length === 0) {
    container.append($("<p>").text("No TAF data available"));
    return container;
  }
  taf.periods.forEach((period) => {
    const periodDiv = $("<div>").addClass("tafPeriod");
    if (period.timeLocal) {
      periodDiv.append($("<p>").text("Local: " + period.timeLocal.substring(0, 5)));
    }
    const periodWeather = $("<p>");
    if (period.tempo) {
      periodWeather.append("Temp: " + period.time)
    }
    if (period.prob) {
      periodWeather.append("Prob: " + period.prob + "%");
      periodDiv.append(
        $("<p>").text(
          "From: " + period.probStart + " to " + period.probEnd
        )
      );
    }
    if (period.wind) {
      periodWeather.append(" " + period.wind);
    }
    if (period.vis) {
      periodWeather.append( " " + period.vis + " SM");
    }
    if (period.weather) {
      periodWeather.append(" " + period.weather);
    }
    if (period.clouds && period.clouds.length > 0) {
      const cloudsList = $("<span>").addClass("cloudsList");
      period.clouds.forEach((cloud, index) => {
        if (index > 0) cloudsList.append(", ");
        cloudsList.append(" " + cloud.coverage + " at " + cloud.base + " ft");
        if (cloud.type) {
          cloudsList.append("<span class='alert'> (" + cloud.type + ")</span>");
        }
      });
      periodWeather.append(cloudsList);
    } else {
      periodWeather.append(" Cloud Bases: N/A");
    }
    container.append(periodDiv.append(periodWeather));
  });
  return container;
}



function PagedDiv(pages) {
  // pages: array of jQuery divs
  let current = 0;
  const container = $('<div>').addClass('pagedDiv').css({ position: 'relative', overflow: 'hidden' });
  const indicator = $('<div>').addClass('pageIndicator').css({
    position: 'absolute',
    bottom: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    padding: '2px 10px',
    borderRadius: '10px',
    fontSize: '1em',
    zIndex: 10
  });
  function showPage(idx) {
    container.empty();
    container.append(pages[idx]);
    indicator.text(`Page ${idx + 1} of ${pages.length}`);
    container.append(indicator);
  }
  showPage(current);
  let timer = setInterval(() => {
    current = (current + 1) % pages.length;
    showPage(current);
  }, 10000);
  container.on('click', () => {
    clearInterval(timer);
    current = (current + 1) % pages.length;
    showPage(current);
    // Restart timer after click
    timer = setInterval(() => {
      current = (current + 1) % pages.length;
      showPage(current);
    }, 5000);
  });
  return container;
}

function App() {
  let data;
  const mainDiv = $('<div class="main">');
  const node = $('<div class="runwaysDiv">');
  async function getWeatherData() {
    data = await fetchWeatherData();
    data.aircraft = await fetchAircraftData();
    const weatherStatusDiv = $('<div class="weatherStatus">');
    weatherStatusDiv.append(statusDiv(data.runways, data.allRed));
    weatherStatusDiv.append($('<div class="radarDiv">').append($('<img class="radar">').attr("src", data.weather.radar)))
    const pageDiv = PagedDiv([getTafDiv(data.weather.taf), ColorExplanationDiv()]);
    mainDiv.append(WeatherDiv(data.weather).append(pageDiv));
    mainDiv.append(weatherStatusDiv);
    mainDiv.append(AircraftStatusDiv(data.aircraft || []));
    if (data.runways && data.runways.length > 0) {
      setRunways(node, data);
    }
  }
  const body = $('<div class="weather-main">');
  body.append(
    $('<div class="title">')
      .append($("<img>").attr("src", logo).attr("height", "75px"))
  );
  body.append(mainDiv);
  body.append(clear());
  body.append("<hr>");
  body.append(node);
  $(document.body).empty(); // Clear the body before appending new content
  $(document.body).append(body);
  getWeatherData();

  // Reload the page every 5 minutes (300,000 ms)
  setTimeout(() => {
    window.location.reload();
  }, 300000);

  // Reload on mobile orientation change
  window.addEventListener("orientationchange", () => {
    window.location.reload();
  });

  return;
}

function ColorExplanationDiv() {
  const container = $('<div>').addClass('colorExplanationDiv').css({
    margin: '1em 0',
    padding: '1em',
    borderRadius: '1em',
    background: '#0e0e0e',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    maxWidth: '500px',
    fontSize: '1em'
  });
  container.append(
    $('<div>').css({ display: 'flex', alignItems: 'center', marginBottom: '0.5em' })
      .append($('<span>').css({ background: 'green', width: '70px', color: '#fff', borderRadius: '0.5em', padding: '0.3em 1em', marginRight: '1em', fontWeight: 'bold' }).text('Green'))
      .append($('<span>').text('May be OK for departure'))
  );
  container.append(
    $('<div>').css({ display: 'flex', alignItems: 'center', marginBottom: '0.5em' })
      .append($('<span>').css({ background: 'yellow', width: '80px', color: '#333', borderRadius: '0.5em', padding: '0.3em 1em', marginRight: '1em', fontWeight: 'bold' }).text('Yellow'))
      .append($('<span>').text('Has some risks, evaluate the safety of flight'))
  );
  container.append(
    $('<div>').css({ display: 'flex', alignItems: 'center' })
      .append($('<span>').css({ background: 'red', width: '80px', color: '#fff', borderRadius: '0.5em', padding: '0.3em 1em', marginRight: '1em', fontWeight: 'bold' }).text('Red'))
      .append($('<span>').text('Some red flags.  Evaluate if flying will be safe'))
  );
  return container;
}

export default App;
