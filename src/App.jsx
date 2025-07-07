import $, { data } from "jquery";
import "./App.css";
import runwayImg from "./assets/runway.png";
import arrowImg from "./assets/arrow.png";
import fromLeft from "./assets/frmLeft.png";
import fromRight from "./assets/frmRight.png";
import logo from "./assets/logo.png";

const isMobile = window.screen.width < 800;

console.log("isMobile:", isMobile);
// Fetch weather data from the backend API
async function fetchWeatherData() {
  //const response = await fetch("http://192.168.0.2:5174/api/weather");
  const response = await fetch("./api/weather");
  if (!response.ok) throw new Error("Failed to fetch weather data");
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
        "30px"
      )
    )
  );
  rw.append(dataDiv);
  if (isMobile) rw.append(clear());
  const imageDiv = $("<div>").addClass("rwImg");
  if (!isMobile) imageDiv.css("float", "right");
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
  rw.append(clear());
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
  if (Array.isArray(weather.clouds) && weather.clouds.length > 0) {
    const cloudsList = $("<ul>");
    weather.clouds.forEach((cloud) => {
      cloudsList.append(
        $("<li>").text(cloud.type + " at " + cloud.base + " ft")
      );
    });
    div.append($("<p>").text("Cloud Bases:"));
    div.append(cloudsList);
  } else {
    div.append($("<p>").text("Cloud Bases: N/A"));
  }
  return div;
}

function statusDiv(runways) {
  let student = "red",
    vfr = "red",
    ifr = "red";
  runways.forEach((rw) => {
    if (rw.student === "green") student = "green";
    if (rw.vfr === "green") vfr = "green";
    if (rw.ifr === "green") ifr = "green";
    if (rw.student === "yellow" && student !== "green") student = "yellow";
    if (rw.vfr === "yellow" && vfr !== "green") vfr = "yellow";
    if (rw.ifr === "yellow" && ifr !== "green") ifr = "yellow";
  });
  return $('<div class="statusDiv">').append(
    StatusBoxes(
      [
        { label: "Solo", color: student },
        { label: "VFR", color: vfr },
        { label: "IFR", color: ifr },
      ],
      "30px"
    )
  );
}

function setRunways(node, data) {
    if (!data.weather.speed || !data.weather.dir) { // If weather data is not available, return an empty div
    node.append($("<div>").addClass("runwayDiv").text("Winds calm"));
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
    box.append($("<div>").text(label));
    container.append(box);
  });
  return container;
}

function App() {
  let data;
  const weatherDiv = $('<div class="weather">');
  const node = $('<div class="runwaysDiv">');
  async function getWeatherData() {
    data = await fetchWeatherData();
    weatherDiv.append(WeatherDiv(data.weather)).append(statusDiv(data.runways));
    if (data.runways && data.runways.length > 0) {
      setRunways(node, data);
    }
  }
  const body = $('<div class="weather-main">');
  body.append(
    $('<div class="title">')
      .append($("<img>").attr("src", logo))
      .append("<h1>Weather Status</h1>")
  );
  body.append(weatherDiv);
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

export default App;
