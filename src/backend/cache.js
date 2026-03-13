const store = {};

/**
 * Store data under a given type for a specified duration.
 * @param {string} type   - Cache key.
 * @param {*}      data   - Data to cache.
 * @param {number} timeMs - Time-to-live in milliseconds.
 */
function setCache(type, data, timeMs) {
  store[type] = {
    data,
    expiresAt: Date.now() + timeMs,
  };
}

/**
 * Retrieve cached data for the given type.
 * Returns the data if it exists and has not expired, otherwise returns null.
 * @param {string} type - Cache key.
 * @returns {*} Cached data or null.
 */
function getCache(type) {
  const entry = store[type];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete store[type];
    return null;
  }
  console.log('using cache for ', type);
  return entry.data;
}

/**
 * Explicitly remove a cache entry.
 * @param {string} type - Cache key.
 */
function clearCache(type) {
  delete store[type];
}

module.exports = { setCache, getCache, clearCache };
