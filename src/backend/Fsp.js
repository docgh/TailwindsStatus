// Fetch aircraft data from FlightSchedulePro API
const fetch = require("node-fetch").default;

async function fetchFspAircraft(subscriptionKey, operator_id) {
  const url =  `https://usc-api.flightschedulepro.com/reports/v1.0/operators/${operator_id}/aircraft`;
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
  return response.json();
}

async function fetchFspSchedule(subscriptionKey, operator_id) {
  // Get current date and tomorrow in ISO format (YYYY-MM-DD)
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const startTime = "gte:" + now.toISOString().split("T")[0];
  const endTime = "lte:" + tomorrow.toISOString().split("T")[0];
  const url = `https://usc-api.flightschedulepro.com/scheduling/v1.0/operators/${operator_id}/reservations?startTime=${startTime}&endTime=${endTime}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-subscription-key": subscriptionKey
    }
  });
  if (!response.ok) {
    console.warn(`Failed to fetch FSP schedule: ${response.status} ${response.statusText}`);
    return null;
  }
  return response.json();
}

async function updateAircraft(aircraft, settings) {
    const fspAircraft = await fetchFspAircraft(settings.fsp_subscription_key, settings.fsp_operator_id);
    if (!fspAircraft || ! fspAircraft.items || !Array.isArray(fspAircraft.items) || fspAircraft.items.length === 0) {
        console.warn("No aircraft data received from FSP");
    } else {
        // Update the aircraft data with FSP data
        fspAircraft.items.forEach((fspItem) => {
            const existing = aircraft.find((a) => a.name === fspItem.registrationTail);
            if (existing) {
                if (fspItem.aircraftAvailability === "Unavailable") {
                    existing.grounded = true;
                } else {
                    existing.grounded = false;
                }
            }
        });
    }

    const schedule = await fetchFspSchedule(settings.fsp_subscription_key, settings.fsp_operator_id);
    if (!schedule || !schedule.items || !Array.isArray(schedule.items) || schedule.items.length === 0) {
        console.warn("No schedule data received from FSP");
    } else {
        // Update the aircraft data with schedule data
        schedule.items.forEach((scheduleItem) => {
            const startTime = new Date(scheduleItem.startTime);
            const endTime = new Date(scheduleItem.endTime);
            const currentTime = new Date();
            if (startTime > currentTime || endTime < currentTime) {
                // Skip items that are not currently active
                return;
            }
            const existing = aircraft.find((a) => scheduleItem.aircraft && scheduleItem.aircraft.tailNumber && (a.name === scheduleItem.aircraft.tailNumber));
            if (existing) {
                settings.mx_keywords.forEach((keyword) => {
                    if (scheduleItem.reservationType.name.includes(keyword)) {
                        existing.maintenance = true;
                    }
                });
                if (scheduleItem.reservationStatus.name === "Checked Out") {
                    existing.checkedOut = true;
                }   
            }
        });
    }

    return aircraft;
}

module.exports = { fetchFspAircraft, updateAircraft };
