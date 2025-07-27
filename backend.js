// backend.js
// Simple Express backend to proxy weather API requestshttps://tailwinds.docgreg.com/

const fetch = require("node-fetch").default;
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const { expr } = require("jquery");
const path = require("path");
const loadConfig = require("./loadConfig");
const parseMetar = require('./parseMetar');
const parseTAF = require('./parseTAF');
const aircraftStatus = require('./getAircraftStatus');

const app = express();
const PORT = 5174;

let cacheData = null;
let aircraftCacheData = null;
let cacheTimestamp = 0;
let aircraftCacheTimestamp = 0;

function setCache(data) {
  cacheData = data;
  cacheTimestamp = Date.now();
}

function getCache() {
  if (
    cacheData &&
    Date.now() - cacheTimestamp <
      (settings.cache_duration_minutes || 5) * 60 * 1000
  ) {
    return cacheData;
  }
  return null;
}

function getAircraftCache() {
if (
    aircraftCacheData &&
    Date.now() - aircraftCacheTimestamp <
      (settings.cache_duration_minutes || 5) * 60 * 1000
  ) {
    return aircraftCacheData;
  }
  return null;
}

function setAircraftCache(data) {
  aircraftCacheData = data;
  aircraftCacheTimestamp = Date.now();
}

app.use(cors());


function windComponents(runwayHeading, windDir, windSpeed) {
  // All angles in degrees, windSpeed in knots
  // Returns { crosswind, headwind }
  // runwayHeading and windDir should be numbers (e.g. 90 for east)
  // windSpeed should be a number
  // Formula: angle = windDir - runwayHeading
  // headwind = windSpeed * cos(angle)
  // crosswind = windSpeed * sin(angle)
  if (windDir === "VRB" || windSpeed <= 0) {
    return { headwind: 0, crosswind: 0 };
  }
  const toRadians = (deg) => deg * (Math.PI / 180);
  let angle = windDir - runwayHeading;
  // Normalize angle to -180..180
  angle = ((angle + 180) % 360) - 180;
  const rad = toRadians(angle);
  const headwind = Math.round(windSpeed * Math.cos(rad));
  const crosswind = Math.round(windSpeed * Math.sin(rad));
  return { headwind, crosswind };
}

function getRunwayData(data) {
  // Example data: { runway: '27L', wind: { dir: 320, speed: 12, gust: 18 } }
  const runwayHeading = parseInt(data.runway) * 10; // Convert e.g. '27' to 270 degrees
  const windDir = data.wind.dir;
  const windSpeed = data.wind.speed;
  const components = windComponents(runwayHeading, windDir, windSpeed);
  const gusts = windComponents(runwayHeading, windDir, data.wind.gust || 0);
  const runway = {
    runway: data.runway,
    headwind: components.headwind,
    crosswind: components.crosswind,
    gust_headwind: gusts.headwind,
    gust_crosswind: gusts.crosswind,
  };
  if (components.headwind >= 0) {
    runway.student = getColor({
      clouds: data.clouds,
      headwind: components.headwind,
      crosswind: components.crosswind,
      gust_headwind: gusts.headwind,
      gust_crosswind: gusts.crosswind,
      headwind_caution: settings.student_wind_caution,
      crosswind_caution: settings.student_wind_x_caution,
      cloud_caution: settings.student_cloud_caution,
      headwind_max: settings.student_wind_max,
      crosswind_max: settings.student_wind_x_max,
      cloud_min: settings.student_cloud_min,
      vis: data.vis,
      vis_caution: settings.student_vis_caution,
      vis_min: settings.student_vis_min,
    });
    runway.vfr = getColor({
      clouds: data.clouds,
      headwind: components.headwind,
      crosswind: components.crosswind,
      gust_headwind: gusts.headwind,
      gust_crosswind: gusts.crosswind,
      headwind_caution: settings.vfr_wind_caution,
      crosswind_caution: settings.vfr_wind_x_caution,
      cloud_caution: settings.vfr_cloud_caution,
      headwind_max: settings.vfr_wind_max,
      crosswind_max: settings.vfr_wind_x_max,
      cloud_min: settings.vfr_cloud_min,
      vis: data.vis,
      vis_caution: settings.vfr_vis_caution,
      vis_min: settings.vfr_vis_min,
    });
    runway.ifr = getColor({
      clouds: data.clouds,
      headwind: components.headwind,
      crosswind: components.crosswind,
      gust_headwind: gusts.headwind,
      gust_crosswind: gusts.crosswind,
      headwind_caution: settings.ifr_wind_caution,
      crosswind_caution: settings.ifr_wind_x_caution,
      cloud_caution: settings.ifr_cloud_caution,
      headwind_max: settings.ifr_wind_max,
      crosswind_max: settings.ifr_wind_x_max,
      cloud_min: settings.ifr_cloud_min,
      vis: data.vis,
      vis_caution: settings.ifr_vis_caution,
      vis_min: settings.ifr_vis_min,
    });
    return runway;
  }
  return [];
}

function unsigned(val) {
  // Returns the absolute value of a number
  return Math.abs(val);
}

function getColor(data) {
  const ceiling = data.clouds.find((c) => c.type !== "FEW") || { base: 999999 };
  if (
    Math.max(data.headwind, data.gust_headwind) > data.headwind_max ||
    Math.max(unsigned(data.crosswind), unsigned(data.gust_crosswind)) >
      data.crosswind_max ||
    data.cloud_min > ceiling.base ||
    data.vis < data.vis_min
  ) {
    return "red";
  }
  if (
    Math.max(data.headwind, data.gust_headwind) > data.headwind_caution ||
    Math.max(unsigned(data.crosswind), unsigned(data.gust_crosswind)) >
      data.crosswind_caution ||
    data.cloud_caution > ceiling.base ||
    data.vis < data.vis_caution
  ) {https://aviationweather.gov/
    return "yellow";
  }
  return "green";
}

// Example usage:
const settings = loadConfig();
// Now you can use settings.airport, settings.runways, etc.

function getRadarImg() {
  // Returns a radar image URL based on the airport code
  return `https://radar.weather.gov/ridge/standard/${settings.radar}_loop.gif`;
}

function checkAllRed(weather) {
  // Check if weather has keywords that should trigger a red status
  if (!settings.red_keywords || !Array.isArray(settings.red_keywords)) {  
    return false;
  }
  for (const keyword of settings.red_keywords) {
    if (weather.weather && weather.weather.includes(keyword)) {
      return true;
    }
    if (weather.taf && weather.taf.tafRaw && weather.taf.tafRaw.includes(keyword)) {
      return true;
    }
  }
  return false;
}

app.get("/api/aircraft", async (req, res) => {
  try {
    const cached = getAircraftCache();
    if (cached) {
      res.json(cached);
      return;
    }
    const aircraft = await aircraftStatus.getAircraftStatus(settings);
    setAircraftCache(aircraft);
    res.json(aircraft);
  } catch (err) {
    console.error("Error fetching aircraft status:", err);
    res.status(500).json({ error: "Failed to fetch aircraft status" });
  }
});

app.get("/api/weather", async (req, res) => {
  try {
    const cached = getCache();
    if (cached) {
      res.json(cached);
      return;
    }
    const response = await fetch(
      "https://aviationweather.gov/api/data/metar?ids=" +
        settings.airport +
        "&taf=true&hours=0&order=id%2C-obs&sep=true"
    );
    if (!response.ok) throw new Error("Failed to fetch weather data");
    const data = await response.text();
    const lines = data.split("\n").filter((line) => line.trim());
    if (lines.length === 0) { // No valid METAR data
      res.status(500).json({ error: "No valid METAR data received" });
      return;
    }
    const weather = parseMetar(lines[0]);
    const taf = lines.slice(1).join("\n");
    if (taf) {  
      weather.taf = parseTAF('TAF ' + taf, settings);
    }
    weather.radar = getRadarImg();
    const returnData = {};
    returnData.weather = weather;
    returnData.runways = [];
    settings.runways.forEach((runway) => {
      const runwayData = getRunwayData({
        runway: runway,
        wind: {
          dir: weather.dir,
          speed: weather.speed,
          gust: weather.gust,
        },
        clouds: weather.clouds,
        vis: weather.vis,
      });
      if (runwayData.length !== 0) {
        returnData.runways.push(runwayData);
      }
    });
    // Sort runways by headwind descending
    returnData.runways.sort((a, b) => b.headwind - a.headwind);
    returnData.allRed = checkAllRed(weather);
    setCache(returnData);
    console.log("Returned: ", JSON.stringify(returnData));
    res.json(returnData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.listen(PORT, () => {
  console.log(`Backend API server running on http://localhost:${PORT}`);
});
