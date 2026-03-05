/**
 * drawPlaneMap.js
 * Generates a 350x350 pixel map image centered on airport coordinates
 * with plane locations marked on the map using OpenStreetMap tiles
 */

const { createCanvas, Image } = require('canvas');
const fetch = require('node-fetch').default;

// Cache for OSM tiles to reduce redundant requests
const tileCache = {};

/**
 * Convert lat/lon to Web Mercator tile coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoom - Zoom level
 * @returns {Object} - {x, y, pixelX, pixelY} tile coordinates and pixel position
 */
function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  
  const xtile = ((lon + 180) / 360) * n;
  const ytile = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  
  return {
    x: Math.floor(xtile),
    y: Math.floor(ytile),
    pixelX: Math.floor((xtile - Math.floor(xtile)) * 256),
    pixelY: Math.floor((ytile - Math.floor(ytile)) * 256)
  };
}

/**
 * Fetch a single tile from OpenStreetMap with caching
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @param {number} zoom - Zoom level
 * @returns {Promise<Buffer|null>} - Tile image buffer
 */
async function fetchOSMTile(x, y, zoom) {
  // Create cache key
  const cacheKey = `${zoom}/${x}/${y}`;
  
  // Check if tile is already in cache
  if (tileCache[cacheKey]) {
    return tileCache[cacheKey];
  }
  
  const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TailwindsStatus/1.0'
      }
    });
    if (!response.ok) return null;
    
    const buffer = await response.buffer();
    
    // Store in cache
    tileCache[cacheKey] = buffer;
    console.log(`Cached new tile: ${cacheKey}`);
    
    return buffer;
  } catch (err) {
    console.error(`Failed to fetch tile ${zoom}/${x}/${y}:`, err);
    return null;
  }
}

/**
 * Calculate distance between two lat/lon points in miles
 * @param {number} lat1 - Starting latitude
 * @param {number} lon1 - Starting longitude
 * @param {number} lat2 - Ending latitude
 * @param {number} lon2 - Ending longitude
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
 * Calculate bearing between two lat/lon points
 * @param {number} lat1 - Starting latitude
 * @param {number} lon1 - Starting longitude
 * @param {number} lat2 - Ending latitude
 * @param {number} lon2 - Ending longitude
 * @returns {number} - Bearing in degrees (0-360)
 */
function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;
  
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Draw a plane icon on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate in pixels
 * @param {number} y - Y coordinate in pixels
 * @param {number} bearing - Plane heading in degrees
 * @param {string} color - Color of the plane icon
 */
function drawPlaneIcon(ctx, x, y, bearing, color = '#FF0000') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((bearing * Math.PI) / 180);
  
  // Draw plane shape (triangle pointing up)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -12); // Front of plane
  ctx.lineTo(-8, 10);  // Bottom left
  ctx.lineTo(0, 5);    // Back center
  ctx.lineTo(8, 10);   // Bottom right
  ctx.closePath();
  ctx.fill();
  
  // Draw outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Generate a map image showing aircraft locations
 * @param {Array<Object>} planes - Array of plane objects with location data
 * @param {Object} settings - Settings object containing airport_lat, airport_lon, etc.
 * @param {Object} options - Optional configuration
 * @param {number} options.width - Map width in pixels (default: 350)
 * @param {number} options.height - Map height in pixels (default: 350)
 * @param {number} options.radiusNM - Map radius in nautical miles (default: 25)
 * @returns {Promise<Buffer>} - PNG image buffer
 */
async function drawPlaneMap(planes, settings, options = {}) {
  const width = options.width || 400;
  const height = options.height || 400;
  const radiusNM = options.radiusNM || 25; // 25 nautical mile radius by default
  const radiusMiles = radiusNM * 1.15078; // Convert nautical miles to statute miles

  const centerLat = settings.airport_lat;
  const centerLon = settings.airport_lon;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Use zoom level 12 for good balance between detail and area coverage
  const zoom = 12;
  
  // Get center tile coordinates
  const centerTile = latLonToTile(centerLat, centerLon, zoom);
  
  // Calculate how many tiles we need to cover the canvas
  const tilesX = Math.ceil(width / 256) + 1;
  const tilesY = Math.ceil(height / 256) + 1;
  
  // Fetch and draw OSM tiles
  try {
    const tilePromises = [];
    for (let dx = -1; dx <= tilesX - 1; dx++) {
      for (let dy = -1; dy <= tilesY - 1; dy++) {
        tilePromises.push({
          dx,
          dy,
          promise: fetchOSMTile(centerTile.x + dx, centerTile.y + dy, zoom)
        });
      }
    }
    
    // Wait for all tiles with a small delay between requests to be respectful
    for (let i = 0; i < tilePromises.length; i++) {
      const { dx, dy, promise } = tilePromises[i];
      const tileBuffer = await promise;
      
      if (tileBuffer) {
        const img = new Image();
        img.src = tileBuffer;
        
        // Calculate position on canvas
        const offsetX = (width / 2) - centerTile.pixelX;
        const offsetY = (height / 2) - centerTile.pixelY;
        const canvasX = offsetX + (dx * 256);
        const canvasY = offsetY + (dy * 256);
        
        ctx.drawImage(img, canvasX, canvasY, 256, 256);
      }
      
      // Small delay to avoid hammering the tile server
      if (i < tilePromises.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  } catch (err) {
    console.error('Error loading OSM tiles, using fallback background:', err);
    // Fallback to colored background if tiles fail
    ctx.fillStyle = '#E8F4F8';
    ctx.fillRect(0, 0, width, height);
  }

  // Draw semi-transparent overlay for better text readability
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(0, 0, width, height);

  // Draw border
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Calculate pixels per mile
  const pixelsPerMile = (width / 2) / radiusMiles;

  // Helper function to convert lat/lon to canvas coordinates
  function latLonToCanvas(lat, lon) {
    const deltaLat = lat - centerLat;
    const deltaLon = lon - centerLon;
    
    // Simple projection (works well for small areas)
    const x = width / 2 + deltaLon * pixelsPerMile * Math.cos((centerLat * Math.PI) / 180) * 69;
    const y = height / 2 - deltaLat * pixelsPerMile * 69;
    
    return { x, y };
  }

  // Draw airport marker at center
  const centerPos = latLonToCanvas(centerLat, centerLon);
  ctx.fillStyle = '#0066CC';
  ctx.beginPath();
  ctx.arc(centerPos.x, centerPos.y, 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw label for airport with background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  const airportLabel = 'AIRPORT';
  const labelMetrics = ctx.measureText(airportLabel);
  ctx.fillRect(centerPos.x - labelMetrics.width / 2 - 2, centerPos.y - 22, labelMetrics.width + 4, 12);
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  ctx.strokeRect(centerPos.x - labelMetrics.width / 2 - 2, centerPos.y - 22, labelMetrics.width + 4, 12);
  ctx.fillStyle = '#000000';
  ctx.fillText(airportLabel, centerPos.x, centerPos.y - 12);

  // Draw planes
  if (Array.isArray(planes)) {
    planes.forEach(plane => {
      // Check if plane has location data
      if (plane.latitude && plane.longitude) {
        const planePos = latLonToCanvas(plane.latitude, plane.longitude);

        // Only draw if within canvas bounds (with some margin)
        if (
          planePos.x > -50 &&
          planePos.x < width + 50 &&
          planePos.y > -50 &&
          planePos.y < height + 50
        ) {
          // Calculate bearing from airport to plane
          //const bearing = getBearing(centerLat, centerLon, plane.latitude, plane.longitude);
          
          // Determine color based on aircraft status
          let color = '#FF0000'; // Default red
          if (plane.location && plane.location.includes('Lat:')) {
            color = '#00AA00'; // Green if in air
          } else if (plane.grounded) {
            color = '#FF0000'; // Red if grounded
          } else if (plane.maintenance) {
            color = '#FFAA00'; // Orange if in maintenance
          } else if (plane.checkedOut) {
            color = '#0066FF'; // Blue if checked out
          }

          // Draw plane icon with bearing
          drawPlaneIcon(ctx, planePos.x, planePos.y, plane.bearing, color);

          // Draw plane label with background
          const planeName = plane.name || 'Unknown';
          ctx.font = '9px Arial';
          ctx.textAlign = 'center';
          const nameMetrics = ctx.measureText(planeName);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillRect(planePos.x - nameMetrics.width / 2 - 2, planePos.y + 16, nameMetrics.width + 4, 11);
          ctx.strokeStyle = '#333333';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(planePos.x - nameMetrics.width / 2 - 2, planePos.y + 16, nameMetrics.width + 4, 11);
          ctx.fillStyle = '#000000';
          ctx.fillText(planeName, planePos.x, planePos.y + 25);
        }
      }
    });
  }


  // Draw scale information with background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '8px Arial';
  ctx.textAlign = 'center';
  const scaleText = `${radiusNM}nm radius`;
  const scaleMetrics = ctx.measureText(scaleText);
  ctx.fillRect(width / 2 - scaleMetrics.width / 2 - 2, height - 18, scaleMetrics.width + 4, 12);
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(width / 2 - scaleMetrics.width / 2 - 2, height - 18, scaleMetrics.width + 4, 12);
  ctx.fillStyle = '#333333';
  ctx.fillText(scaleText, width / 2, height - 8);

  return canvas.toBuffer('image/png');
}

/**
 * Clear the tile cache
 */
function clearTileCache() {
  Object.keys(tileCache).forEach(key => {
    delete tileCache[key];
  });
  console.log('Tile cache cleared');
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    cachedTiles: Object.keys(tileCache).length,
    cacheSize: Object.keys(tileCache).reduce((total, key) => {
      return total + (tileCache[key]?.length || 0);
    }, 0)
  };
}

module.exports = {
  drawPlaneMap,
  getDistanceMiles,
  getBearing,
  clearTileCache,
  getCacheStats
};
