const e = require("cors");

const fetch = require("node-fetch").default;

let maintCache = null;
let maintCacheTimestamp = 0;
let lastSquawk = null;
let resolvedSquawks = [];
let squawkDiff = null;
let aircraftList = null;

let prior = [];
let test = false;

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

async function getAircraftSquawks(subscriptionKey, operator_id, aircraftId, aircraft) {
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
  return response.json().then(data => {
    const tailNumber = aircraft.filter(ac => ac.aircraftId === aircraftId)[0].tailNumber;
    data.items.forEach(sq => {
      sq.tailNumber = tailNumber;
    });
    return data.items.filter(sq => !sq.resolved);
  });
}

function getSquawkDiff() {
  if (squawkDiff === null || squawkDiff.length === 0) {
    return [];
  }
  const diff = squawkDiff;
  squawkDiff = null; // Reset after getting the diff
  return diff;
}

function getResolvedSquawks() {
  if (resolvedSquawks === null || resolvedSquawks.length === 0) {
    return [];
  }
  const resolved = resolvedSquawks;
  resolvedSquawks = []; // Reset after getting the resolved squawks
  return resolved;
}

function updateGrounded(squawks, settings) {
    if (aircraftList === null) {
        aircraftList = settings.aircraft.map(acName => {
            return { tailNumber: acName, grounded: false };
        });
    }
    aircraftList.forEach(ac => {
      let hasGroundingSquawk = false;
      squawks.forEach(sq => {
        if (sq === null) return;
        hasGroundingSquawk = hasGroundingSquawk || sq.some(s => s.tailNumber === ac.tailNumber && s.groundAircraft);
      });
      ac.grounded = hasGroundingSquawk;
    });
}

function getAircraftGroundingStatus() {
    if (aircraftList === null) {
        return [];
    } 
    return aircraftList;;
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
    const squawkPromises = await aircraft.map(async ac => await getAircraftSquawks(fsp_subscription_key, fsp_operator_id, ac.aircraftId, aircraft));
    return Promise.all([maintStatusPromises, squawkPromises]).then(async (results) => {
        const maintStatus = await Promise.all(results[0]);
        const squawks = await Promise.all(results[1]);
        updateGrounded(squawks, settings);
          if (lastSquawk !== null) {
            // Find new squawks not already in lastSquawk (by id or title/desc)
            let diff = [];
            squawks.forEach(apList => {
              (apList || []).forEach(ap => {
                // Check if lastSquawk already contains this squawk
                const exists = lastSquawk.some(sq =>
                  (ap.squawkId && sq.squawkId && ap.squawkId === sq.squawkId)
                );
                if (!exists) diff.push(ap);
              });
            });
            if (diff.length > 0) {
              console.log(`Found ${diff.length} new squawks`);
              lastSquawk.push(...diff);
              if (squawkDiff === null) {
                squawkDiff = [];
              }
              squawkDiff.push(...diff);
            }
            // Check if any squawks have been resolved since last check
            lastSquawk.forEach(sq => {
              const stillExists = squawks.some(apList =>
                (apList || []).some(ap => ap.squawkId === sq.squawkId && ap.resolved === sq.resolved)
              );
              if (!stillExists) {
                console.log(`Resolved squawk: ${sq.squawkId}`);
                resolvedSquawks.push(sq);
                lastSquawk = lastSquawk.filter(s => s.squawkId !== sq.squawkId); // remove resolved squawk from lastSquawk
              }
            });
          } else {
            // Reset list of squawks
            lastSquawk = [];
            squawks.forEach(ap => {
              ap.forEach(sq => {
                if (sq && !sq.resolved) {
                  lastSquawk.push(sq);
                }
              });
            });
          }
        const result = aircraft.map((ac, index) => {
            return {
                ...ac,
                maintenance: maintStatus[index].items.filter(m => m.status && m.status.id && m.status.id !== 1), // only include active maintenance reminders || null,
                squawks: squawks[index] || [],
                grounded: aircraftList.find(a => a.tailNumber === ac.tailNumber)?.grounded || false
            };
        });
        setCache(result);
        return result;
    });
}

exports.getMaintStatus = getMaintStatus;
exports.getSquawkDiff = getSquawkDiff;
exports.getResolvedSquawks = getResolvedSquawks;
exports.getAircraftGroundingStatus = getAircraftGroundingStatus;
