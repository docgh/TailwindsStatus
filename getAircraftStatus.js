
const fetch = require("node-fetch").default;
const { updateAircraft } = require("./Fsp");

let oauthToken = null;

async function getAircraftStatus(settings) {
    if (oauthToken === null) {
        oauthToken = await getOAuth2Token(settings.token_url, settings.client_id, settings.client_secret)
            .catch(err => {
                console.error("Failed to retrieve OAuth2 token:", err);
                return null;
            });
    }
    let aircraft_status = settings.aircraft.map(ac => {
        return {
            icao24: settings[ac + "_icao24"] || null,
            name: ac,
            location: "Landed"
        };
    });

    let response = null;
    try {
        response = await queryOpenSkyStates(getIcao24List(settings));
    }
    catch (err) {  // If the initial query fails, we will try to refresh the token and query again
        if (oauthToken === null) {
            oauthToken = await getOAuth2Token(settings.token_url, settings.client_id, settings.client_secret);
            try {
                response = await queryOpenSkyStates(getIcao24List(settings));
            } catch (err) {
                console.error("Failed to query OpenSky API after token refresh:", err);
                return [];
            }
        } else {
            console.error("Failed to query OpenSky API:", err);
            return [];
        }
    }
    if (response.states === null || response.states.length === 0) {
        //console.warn("No aircraft states found in OpenSky response");
        await updateAircraft(aircraft_status, settings);
        return aircraft_status;
    }
    response.states.map(state => {
        const icao24 = state[0];
        const ac = aircraft_status.find(ac => ac.icao24 === icao24);
        if (ac) {
            ac.location = `Lat: ${state[6]}, Lon: ${state[5]}`;
            ac.distance = getDistanceMiles(
                settings.airport_lat, 
                settings.airport_lon, 
                state[6], 
                state[5]
            ).toFixed(2) + " mi";
            ac.altitude = metersToFeet(state[7]);
            ac.velocity = state[9];
            //ac.grounded = state[8] === 0; // Assuming grounded if vertical rate is zero
            ac.maintenance = false; // Placeholder, can be set based on additional logic
        }
    });
    await updateAircraft(aircraft_status, settings);
    return aircraft_status;
}



/**
 * Retrieve OAuth2 access token using client credentials grant
 * @param {string} url - The token endpoint URL
 * @param {string} clientId - The client_id
 * @param {string} clientSecret - The client_secret
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
 * Query OpenSky Network API for aircraft states by ICAO24 IDs
 * @param {string[]} icao24List - Array of ICAO24 aircraft IDs
 * @returns {Promise<Object>} - Resolves to the API response JSON
 */
async function queryOpenSkyStates(icao24List) {
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
  return response.json();
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
  getAircraftStatus,
  getOAuth2Token,
  queryOpenSkyStates,
  getDistanceMiles,
  metersToFeet
};
