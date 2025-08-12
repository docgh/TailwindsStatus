


// backend.js
// Simple Express backend to proxy weather API requestshttps://tailwinds.docgreg.com/

const fetch = require("node-fetch").default;
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const { expr, get } = require("jquery");
const path = require("path");
const loadConfig = require("./loadConfig");
const parseMetar = require('./parseMetar');
const { parseTAF, weatherConditions } = require('./parseTAF');
const aircraftStatus = require('./getAircraftStatus');
const { updateAircraft } = require("./Fsp");
const { getRunwayData } = require("./analysis");
const maintStatus = require("./maintStatus");

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
      (settings.cache_duration_minutes || settings.update_frequency || 5) * 60 * 1000
  ) {
    return cacheData;
  }
  return null;
}

function getAircraftCache() {
if (
    aircraftCacheData &&
    Date.now() - aircraftCacheTimestamp <
      (settings.cache_duration_minutes || settings.update_frequency || 5) * 60 * 1000
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
  let found = false;
  for (const keyword of settings.red_keywords) {
    if (weather.weather && weather.weather.includes(keyword)) {
      if (!weather.keywords) weather.keywords = [];
      if (weatherConditions[keyword]) {
        weather.keywords.push(weatherConditions[keyword]);
      }
      weather.keywords.push(keyword);
      found = true;
    }
    if (weather.taf && weather.taf.tafRaw && weather.taf.tafRaw.includes(keyword)) {
      if (!weather.taf_keywords) weather.taf_keywords = [];
      if (weatherConditions[keyword]) {
        weather.taf_keywords.push(weatherConditions[keyword]);
      } else {
        weather.taf_keywords.push(keyword);
      }
      found = true;
    }
    weather.nearby_tafs?.forEach((taf) => {
      if (taf.tafRaw && taf.tafRaw.includes(keyword)) {
        if (!taf.keywords) taf.keywords = [];
        if (weatherConditions[keyword]) {
          taf.keywords.push(weatherConditions[keyword]);
        } else {
          taf.keywords.push(keyword);
        }
        found = true;
      }
    });
  }
  return found;
}


app.get("/api/maint", async (req, res) => {
  try {
    const aircraft = await maintStatus.getMaintStatus(settings);
    if (!aircraft || aircraft.length === 0) {
      res.json({ error: "No aircraft maintenance data available" });
      return;
    }
    await updateAircraft(aircraft, settings);
    res.json(aircraft);
  } catch (err) {
    console.error("Error fetching aircraft maintenance status:", err);
    res.status(500).json({ error: "Failed to fetch aircraft maintenance status" });
  }
});


app.get("/api/aircraft", async (req, res) => {
  try {
    const cached = getAircraftCache();
    if (cached) {
      res.json(cached);
      return;
    }
    const aircraft = await aircraftStatus.getAircraftStatus(settings);
    if (!aircraft || aircraft.length === 0) {
      res.json({ error: "No aircraft data available" });
      return;
    }
    await updateAircraft(aircraft, settings);
    setAircraftCache(aircraft);
    res.json(aircraft);
  } catch (err) {
    console.error("Error fetching aircraft status:", err);
    res.status(500).json({ error: "Failed to fetch aircraft status" });
  }
});

async function getNearby(weatherdata) {
  await Promise.all(settings.nearby.map(async (airport) => {
    // Fetch TAF for each nearby airport
    const response = await fetch(
      "https://aviationweather.gov/api/data/metar?ids=" +
        airport +
        "&taf=true&hours=0&order=id%2C-obs&sep=true"
    );
    if (!response.ok) {
      console.error(`Failed to fetch weather data for ${airport}`);
      return;
    }
    const data = await response.text();
    const lines = data.split("\n").filter((line) => line.trim());
    const weather = parseMetar(lines[0]);
    const taf = lines.slice(1).join("\n");
    if (taf) {  
      if (!weatherdata.nearby_tafs) weatherdata.nearby_tafs = [];
      weatherdata.nearby_tafs.push(parseTAF('TAF ' + taf, settings));
    }
  }));
}

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
    await getNearby(weather);
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
      }, settings);
      if (runwayData.length !== 0) {
        returnData.runways.push(runwayData);
      }
    });
    // Sort runways by headwind descending
    returnData.runways.sort((a, b) => b.headwind - a.headwind);
    returnData.allRed = checkAllRed(weather);
    returnData.update_frequency = settings.update_frequency || 5; // Default to 5 minutes if not set
    setCache(returnData);
    console.log("Returned: ", JSON.stringify(returnData));
    res.json(returnData);
  } catch (err) {
    console.error("Error fetching weather data:", err);
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, "dist"), { extensions: ['html', 'htm'] }));

app.listen(PORT, () => {
  console.log(`Backend API server running on http://localhost:${PORT}`);
});
