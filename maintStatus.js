const fetch = require("node-fetch").default;

let maintCache = null;
let maintCacheTimestamp = 0;

function getCache() {
  const now = Date.now();
  // 5 minutes cache
  if (maintCache && (now - maintCacheTimestamp < 5 * 60 * 1000)) {
    return maintCache;
  }
  return null;
}

function setCache(data) {
  maintCache = data;    
    maintCacheTimestamp = Date.now();
}

async function getAircraft(subscriptionKey, operator_id) {
  const url = `https://usc-api.flightschedulepro.com/core/v1.0/operators/${operator_id}/aircraft`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-subscription-key": subscriptionKey
    }
  });
  if (!response.ok) {
    console.warn(`Failed to fetch FSP aircraft: ${response.status} ${response.statusText}`);
    return null;
  }
  const all_aircraft = await response.json();
  const aircraft = all_aircraft.items.filter(ac => !ac.isSimulator && ac.status && ac.status.id && ac.status.id === 1); // only include active aircraft
    if (!aircraft || aircraft.length === 0) {
        console.warn("No active aircraft found in FSP data");
        return [];
    }
   return aircraft;  
}

async function getAircraftMaintenanceStatus(subscriptionKey, operator_id, aircraftId) {
  const url = `https://usc-api.flightschedulepro.com/core/v1.0/operators/${operator_id}/aircraft/${aircraftId}/maintenanceReminders`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-subscription-key": subscriptionKey
    }
  });
  if (!response.ok) {
    console.warn(`Failed to fetch maintenance status for aircraft ${aircraftId}: ${response.status} ${response.statusText}`);
    return null;
  }
  return response.json();
}

async function getAircraftSquawks(subscriptionKey, operator_id, aircraftId) {
  const url = `https://usc-api.flightschedulepro.com/core/v1.0/operators/${operator_id}/aircraft/${aircraftId}/squawks`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-subscription-key": subscriptionKey
    }
  });
  if (!response.ok) {
    console.warn(`Failed to fetch squawks for aircraft ${aircraftId}: ${response.status} ${response.statusText}`);
    return null;
  }
  return response.json(); 
}

async function getMaintStatus(settings) {
    const cached = getCache();
    if (cached) {   
        return cached;
    }
    const { fsp_subscription_key, fsp_operator_id } = settings;
    const aircraft = await getAircraft(fsp_subscription_key, fsp_operator_id);
    if (!aircraft) {
        console.warn("No aircraft data available");
        return null;
    }
    // Fetch maintenance status for each aircraft
    const maintStatusPromises = await aircraft.map(async ac => await getAircraftMaintenanceStatus(fsp_subscription_key, fsp_operator_id, ac.aircraftId));
    // Fetch squawks for each aircraft
    const squawkPromises = await aircraft.map(async ac => await getAircraftSquawks(fsp_subscription_key, fsp_operator_id, ac.aircraftId));
    return Promise.all([maintStatusPromises, squawkPromises]).then(async (results) => {
        const maintStatus = await Promise.all(results[0]);
        const squawks = await Promise.all(results[1]);
        const result = aircraft.map((ac, index) => {
            return {
                ...ac,
                maintenance: maintStatus[index].items.filter(m => m.status && m.status.id && m.status.id !== 1), // only include active maintenance reminders || null,
                squawks: squawks[index].items.filter(s => !s.resolved) || []
            };
        });
        setCache(result);
        return result;
    });
}

exports.getMaintStatus = getMaintStatus;
