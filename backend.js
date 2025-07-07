// backend.js
// Simple Express backend to proxy weather API requests

const fetch = require("node-fetch").default;
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const { expr } = require("jquery");
const path = require("path");
const loadConfig = require("./loadConfig");

const app = express();
const PORT = 5174;

let cacheData = null;
let cacheTimestamp = 0;

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

app.use(cors());

function parseMetar(metar) {
  // Example METAR: "KPNE 261554Z 32012KT 10SM FEW050 SCT250 27/13 A3007 RMK AO2 SLP181 T02720128"
  const result = {
    wind: null,
    dir: null,
    speed: null,
    gust: null,
    vis: null,
    clouds: [],
  };
  const parts = metar.split(" ");
  // Wind: e.g. 32012KT or 32012G18KT
  const windRegex = /([0-9]{3})([0-9]{2,3})(G([0-9]{2,3}))?KT/;
  for (let part of parts) {
    if (windRegex.test(part)) {
      const match = part.match(windRegex);
      result.wind = part;
      result.dir = match[1];
      result.speed = match[2];
      result.gust = match[4] || null;
    }
    if (/^VRB/.test(part)) {
      // Handle variable wind direction
      result.wind = "VRB";
      result.dir = "VRB";
      result.speed = part.replace("VRB", "").replace("KT", "");
    }
    // Visibility: e.g. 10SM
    if (/^[0-9]+SM$/.test(part)) {
      result.vis = part.replace("SM", "");
    }
    // Clouds: e.g. FEW050, SCT250, BKN100, OVC200
    if (/^(FEW|SCT|BKN|OVC)[0-9]{3}$/.test(part)) {
      const type = part.substring(0, 3);
      const base = parseInt(part.substring(3)) * 100; // in feet
      result.clouds.push({ type, base });
    }
  }
  return result;
}

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
  ) {
    return "yellow";
  }
  return "green";
}

// Returns a weather radar image URL for a specified airport/location (ICAO code or lat/lon)
function getRadarImage(location) {
  // If location is an ICAO code, use it directly; otherwise, expect { lat, lon }
  // Example: https://radar.weather.gov/ridge/standard/KPHL_loop.gif
  // Fallback: use the closest NEXRAD radar site for the airport
  // For demonstration, assume US ICAO and use the last 3 letters for NEXRAD
  let radarCode = null;
  if (typeof location === "string" && location.length === 4) {
    radarCode = location.substring(1).toUpperCase();
  } else if (location && location.lat && location.lon) {
    // For lat/lon, a real implementation would look up the nearest radar site
    // Here, just return a generic US radar image
    return "https://radar.weather.gov/ridge/Conus/RadarImg/latest_radaronly.gif";
  } else {
    // Default US radar
    return "https://radar.weather.gov/ridge/Conus/RadarImg/latest_radaronly.gif";
  }
  return `https://radar.weather.gov/ridge/standard/K${radarCode}_loop.gif`;
}

// Example usage:
const settings = loadConfig();
// Now you can use settings.airport, settings.runways, etc.

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
        "&hours=0&order=id%2C-obs&sep=true"
    );
    if (!response.ok) throw new Error("Failed to fetch weather data");
    const data = await response.text();
    const weather = parseMetar(data);
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
