/**
 * sunset.js
 * Calculate sunrise and sunset times for a given date and location.
 * Uses a simplified NOAA algorithm and returns UTC Date objects.
 */

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad) {
  return (rad * 180) / Math.PI;
}

function normalizeDegrees(deg) {
  let result = deg % 360;
  if (result < 0) result += 360;
  return result;
}

function normalizeHours(hours) {
  let result = hours % 24;
  if (result < 0) result += 24;
  return result;
}

function getDayOfYear(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diff = date - start;
  return Math.floor(diff / 86400000) + 1;
}

function calculateSunTime(lat, lon, date, isSunrise) {
  const zenith = 90.833; // Official zenith for sunrise/sunset
  const dayOfYear = getDayOfYear(date);
  const lngHour = lon / 15;

  // Approximate time
  const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;

  // Sun's mean anomaly
  const M = (0.9856 * t) - 3.289;

  // Sun's true longitude
  let L = M + (1.916 * Math.sin(toRadians(M))) + (0.020 * Math.sin(toRadians(2 * M))) + 282.634;
  L = normalizeDegrees(L);

  // Sun's right ascension
  let RA = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(L))));
  RA = normalizeDegrees(RA);

  // Quadrant adjustment
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = RA + (Lquadrant - RAquadrant);
  RA = RA / 15; // Convert to hours

  // Sun's declination
  const sinDec = 0.39782 * Math.sin(toRadians(L));
  const cosDec = Math.cos(Math.asin(sinDec));

  // Sun's local hour angle
  const cosH = (Math.cos(toRadians(zenith)) - (sinDec * Math.sin(toRadians(lat)))) / (cosDec * Math.cos(toRadians(lat)));
  if (cosH > 1) return null; // Sun never rises
  if (cosH < -1) return null; // Sun never sets

  // Local hour angle
  let H = isSunrise ? 360 - toDegrees(Math.acos(cosH)) : toDegrees(Math.acos(cosH));
  H = H / 15;

  // Local mean time
  const T = H + RA - (0.06571 * t) - 6.622;

  // Universal time
  const UT = normalizeHours(T - lngHour);

  const hour = Math.floor(UT);
  const minute = Math.floor((UT - hour) * 60);
  const second = Math.floor((((UT - hour) * 60) - minute) * 60);

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, second));
}

/**
 * Get sunrise and sunset times (UTC) for the given settings.
 * @param {Object} settings - Must include airport_lat and airport_lon
 * @param {Date} [date] - Optional date, defaults to now
 * @returns {{ sunrise: Date|null, sunset: Date|null }}
 */
function getSunriseSunset(settings, date = new Date()) {
  const lat = Number(settings.airport_lat);
  const lon = Number(settings.airport_lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Invalid airport_lat or airport_lon in settings');
  }

  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const sunrise = calculateSunTime(lat, lon, utcDate, true);
  const sunset = calculateSunTime(lat, lon, utcDate, false);

  return { sunrise, sunset };
}

module.exports = {
  getSunriseSunset
};
