const { cache } = require("react");

const fetch = require("node-fetch").default;

let oauthToken = null;
let aircraft_status = null;
let openSkyCache = {
    data: null,
    timestamp: null
};
let adsbfiCache = {
    data: null,
    timestamp: null
};
let cacheTimeMs = null;

async function getAircraftLocation(settings) {
  return await getAircraftLocations(settings, true);
}

async function getAircraftLocations(settings) {

    if (aircraft_status === null) {
      aircraft_status = settings.aircraft.map(ac => {
          return {
              icao24: settings[ac + "_icao24"] || null,
              name: ac,
              location: "Landed"
          };
      });
    }
    if (aircraft_status.length === 0) {
        return [];
    }
    cleanAircraftStatus();
    await getOpenSkyLocation(settings);
    await getadsbfiLocation(settings);
    await getDump1090Location(settings);
    return aircraft_status;
}

// Resets location data for any aircraft that hasn't been updated in the last minute, assuming they have likely landed or are no longer trackable
function cleanAircraftStatus() {
    aircraft_status.map(ac => {
        if (ac.lastUpdate && ac.lastUpdate < new Date(Date.now() - 60 * 1000)) {
            ac.latitude = null;
            ac.longitude = null;
            ac.location = "Landed";
            ac.distance = null;
            ac.altitude = null;
            ac.lastUpdate = null;
        }
    });
}

async function getDump1090Location(settings) {
    try {
        // Parse dump1090_url which can be a single URL or comma-separated URLs
        let urls = [];
        if (settings.dump1090_url) {
            urls = settings.dump1090_url
                .split(',')
                .map(url => url.trim())
                .filter(url => url.length > 0);
        }
        
        if (urls.length === 0) {
            console.warn("No dump1090 URLs configured");
            return;
        }
        
        // Try each URL until we get valid data
        let data = null;
        let lastError = null;
        
        for (const url of urls) {
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    lastError = `HTTP ${response.status} ${response.statusText}`;
                    console.warn(`Failed to fetch from ${url}: ${lastError}`);
                    continue;
                }
                
                const airdata = await response.json();
                if (airdata.aircraft) data = (data || []).concat(airdata.aircraft);
                if (!Array.isArray(data) || data.length === 0) {
                    lastError = "Response is empty or not an array";
                    console.warn(`Invalid data from ${url}: ${lastError}`);
                    continue;
                }
                
                // Successfully got valid data
                console.log(`Successfully fetched dump1090 data from: ${url}`);
                break;
            } catch (err) {
                lastError = err.message;
                console.error(`Error fetching from ${url}:`, err);
            }
        }
        
        // Process the data if we got it
        if (data && Array.isArray(data) && data.length > 0) {
          applyData(data, aircraft_status, settings, 'dump1090');
        } else {
            console.warn(`Unable to get valid dump1090 data from any configured URL. Last error: ${lastError}`);
        }
    } catch (err) {
        console.error("Error processing dump1090 data:", err);
    }
}

async function getadsbfiLocation(settings) {
  if (!settings.useadsbfi) { // Check if adsbfi_url is configured
    console.warn("ADSB.fi not enabled, skipping ADSB.fi data retrieval");
    return;
  }
    try {
          // Check if we have cached data that is still valid (2 seconds)
          const adsbfiCacheTimeMs = 2000; // 2 seconds
          
          if (adsbfiCache.data && adsbfiCache.timestamp) {
            const timeSinceCache = Date.now() - adsbfiCache.timestamp;
            if (timeSinceCache < adsbfiCacheTimeMs) {
              console.log(`Using cached ADSB.fi data (${Math.round(timeSinceCache / 1000)}s old)`);
              applyData(adsbfiCache.data, aircraft_status, settings, 'adsbfi');
              return;
            }
          }

          // Try each URL until we get valid data
          let data = null;
          let lastError = null;
          
          let baseUrl = 'https://opendata.adsb.fi/api/v2/icao/';
          const params = new URLSearchParams();
          const icao24List = getIcao24List(settings);
          if (Array.isArray(icao24List) && icao24List.length > 0) {
             //params.append('icao24', icao24List.join(','));
             icao24List.forEach(icao => baseUrl += `${icao},`);
          }
          //const url = `${baseUrl}?${params.toString()}`;
          const response = await fetch(baseUrl);
          if (!response.ok) {
            lastError = `HTTP ${response.status} ${response.statusText}`;
            console.warn(`Failed to fetch from adsbfi: ${lastError}`);
            return;
          }
          const airdata = await response.json();
          if (airdata.ac) data = (data || []).concat(airdata.ac);

          
          // Successfully got valid data - cache it
          adsbfiCache.data = data;
          adsbfiCache.timestamp = Date.now();
          console.log(`Successfully fetched adsbfi data from: ${baseUrl} (cached for 2s)`);
              if (!Array.isArray(data) || data.length === 0) {
              return;
          }
          applyData(data, aircraft_status, settings, 'adsbfi');

        } catch (err) {
        lastError = err.message;
        console.error(`Error fetching from adsbfi`, err);
      }
      
}

function applyData(data, aircraft_status, settings, source) {
      data.forEach(ac => {
        const icao24 = ac.hex;
        const existingAc = aircraft_status.find(a => a.icao24 === icao24);
        if (existingAc && ac.lat && ac.lon) {
            console.log(`Updating location for ${existingAc.name} from ${source} data`);
            if (ac.alt_baro === 'ground') {
                existingAc.location = 'Landed';
                existingAc.altitude = 0;
            } else {
                existingAc.lastUpdate = new Date();
                existingAc.latitude = ac.lat;
                existingAc.longitude = ac.lon;  
                existingAc.bearing = ac.track;
                existingAc.location = `Lat: ${ac.lat}, Lon: ${ac.lon}`;
                if (ac.altitude || ac.alt_geom || ac.alt_baro) {
                  existingAc.altitude = ac.altitude ? ac.altitude : (ac.alt_baro ? ac.alt_baro : ac.alt_geom);
                } 
                existingAc.distance = getDistanceMiles(
                    settings.airport_lat,
                    settings.airport_lon,
                    ac.lat,
                    ac.lon
                ).toFixed(2) + " mi";
            }

        }
    });
}

async function getOpenSkyLocation(settings) {
      if (!settings.opensky_token_url || !settings.opensky_client_id || !settings.opensky_client_secret) {
        console.warn("OpenSky API credentials not fully configured, skipping OpenSky data retrieval");
        return;
    }
      if (oauthToken === null) {
        oauthToken = await getOAuth2Token(settings.opensky_token_url, settings.opensky_client_id, settings.opensky_client_secret)
            .catch(err => {
                console.error("Failed to retrieve OAuth2 token:", err);
                return;
            });
    }
    let response = null;
    try {
        response = await queryOpenSkyStates(getIcao24List(settings), settings);
    }
    catch (err) {  // If the initial query fails, we will try to refresh the token and query again
        if (oauthToken === null) {
            oauthToken = await getOAuth2Token(settings.opensky_token_url, settings.opensky_client_id, settings.opensky_client_secret);
            try {
                response = await queryOpenSkyStates(getIcao24List(settings), settings);
            } catch (err) {
                console.error("Failed to query OpenSky API after token refresh:", err);
                return;
            }
        } else {
            console.error("Failed to query OpenSky API:", err);
            return;
        }
    }
    if (response.states === null || response.states.length === 0) {
        return;
    }
    response.states.map(state => {
        const icao24 = state[0];
        const ac = aircraft_status.find(ac => ac.icao24 === icao24);
        if (ac) {
            console.log(`Updating location for ${ac.name} from OpenSky data`);
            ac.lastUpdate = new Date();
            ac.latitude = state[6];
            ac.longitude = state[5];
            ac.location = `Lat: ${state[6]}, Lon: ${state[5]}`;
            ac.distance = getDistanceMiles(
                settings.airport_lat, 
                settings.airport_lon, 
                state[6], 
                state[5]
            ).toFixed(2) + " mi";
            ac.altitude = metersToFeet(state[7]);
            ac.bearing = state[10];
            ac.velocity = state[9];
            //ac.grounded = state[8] === 0; // Assuming grounded if vertical rate is zero
            ac.maintenance = false; // Placeholder, can be set based on additional logic
        }
    });
}

/**
 * Retrieve OAuth2 access token using client credentials grant
 * @param {string} url - The token endpoint URL
 * @param {string} clientId - The opensky_client_id
 * @param {string} clientSecret - The opensky_client_secret
 * @returns {Promise<string>} - Resolves to the access token
 */
async function getOAuth2Token(url, clientId, clientSecret) {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  if (!response.ok) {
    throw new Error(`Failed to retrieve token: ${response.status} ${response.statusText}`);
  }
  // print response headers for debugging
  const data = await response.json();
  return data.access_token;
}

function getIcao24List(settings) {
    const aircraft = settings.aircraft;
  // Extracts ICAO24 IDs from the aircraft data
  if (!Array.isArray(aircraft) || aircraft.length === 0) {
    return [];
  }
  return aircraft.map(ac => settings[ac+"_icao24"]).filter(id => typeof id === 'string' && id.length === 6);
}




/**
 * Query OpenSky Network API for aircraft states by ICAO24 IDs with caching
 * @param {string[]} icao24List - Array of ICAO24 aircraft IDs
 * @param {Object} settings - Settings object containing opensky_cache_time
 * @returns {Promise<Object>} - Resolves to the API response JSON
 */
async function queryOpenSkyStates(icao24List, settings) {
  if (cacheTimeMs === null) {
    const cacheTimeMinutes = Number(settings.opensky_cache_time) || 5; // Default to 5 minutes if not set
    cacheTimeMs = cacheTimeMinutes * 60 * 1000;
  }
  // Check if we have cached data that is still valid  
  if (openSkyCache.data && openSkyCache.timestamp) {
    const timeSinceCache = Date.now() - openSkyCache.timestamp;
    if (timeSinceCache < cacheTimeMs) {
      console.log(`Using cached OpenSky data (${Math.round(timeSinceCache / 1000)}s old, cache expires in ${Math.round((cacheTimeMs - timeSinceCache) / 1000)}s)`);
      return openSkyCache.data;
    }
  }
  
  const baseUrl = 'https://opensky-network.org/api/states/all';
  const params = new URLSearchParams();
  if (Array.isArray(icao24List) && icao24List.length > 0) {
    params.append('icao24', icao24List.join(','));
  }
  const url = `${baseUrl}?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
            "Authorization": `Bearer ${oauthToken}`
        }
  });
  if (!response.ok) {
    oauthToken = null; // Reset token on failure
    console.error(`OpenSky API request failed: ${response.status} ${response.statusText}`);
    throw new Error(`Failed to query OpenSky API: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Cache the response
  openSkyCache.data = data;
  openSkyCache.timestamp = Date.now();
  
  return data;
}

/**
 * Calculate the distance in miles between two latitude/longitude points using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in miles
 */
function getDistanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 3958.8; // Radius of Earth in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert meters to feet
 * @param {number} meters - Value in meters
 * @returns {number} - Value in feet
 */
function metersToFeet(meters) {
  return Math.round(meters * 3.28084);
}

module.exports = {
  getAircraftLocation,
  getOAuth2Token,
  queryOpenSkyStates,
  getDistanceMiles,
  metersToFeet,
  cleanAircraftStatus
};
