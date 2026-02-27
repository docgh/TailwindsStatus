import $ from 'jquery';

// AircraftStatusDiv.js
// Returns a div containing a list of aircraft and their status
// Usage: import AircraftStatusDiv from './AircraftStatusDiv';
//        $('body').append(AircraftStatusDiv([{ name: 'N123AB', location: 'Hangar 1' }, ...]));

function AircraftStatusDiv(aircraftList) {
  const container = $('<div>').addClass('aircraftStatusDiv');
  container.append($('<h2>').text('Aircraft Status'));
  if (!Array.isArray(aircraftList) || aircraftList.length === 0) {
    container.append($('<p>').text('No aircraft data available'));
    return container;
  }
  const list = $('<ul>').addClass('aircraftList');
  aircraftList.forEach(ac => {
    const item = $('<li>').addClass('aircraftItem');
    item.append($('<span>').addClass('aircraftName').css({ fontWeight: 'bold', marginRight: '1em' }).text(ac.name || 'Unknown'));
    let location = ac.location ? `${ac.location}` : 'Location: Unknown';
    const locationSpan = $('<span>').addClass('aircraftLocation');
    if (ac.distance && ac.altitude) {
      location = `Dist: ${ac.distance}, Alt: ${ac.altitude} ft`;
    } else { // If not in air, show if checked out, grounded, or in maintenance
      if (ac.checkedOut) {
        location = 'Checked Out';
        locationSpan.css({ color: 'green', fontWeight: 'bold' }); // Highlight checked out aircraft
      }
      if (ac.grounded) {
        location = 'Unavailable';
        locationSpan.css({ color: 'red', fontWeight: 'bold' }); // Highlight grounded aircraft
      }
      if (ac.maintenance) {
        location = 'Maintenance';
        locationSpan.css({ color: 'orange', fontWeight: 'bold' }); // Highlight aircraft in maintenance
      } 
    }
    item.append(locationSpan.append(location));
    list.append(item);
  });
  container.append(list);
  return container;
}

/**
 * Creates a wrapper div that cycles between AircraftStatusDiv and map image
 * @param {Array<Object>} aircraftList - Array of aircraft objects
 * @param {string} mapImageData - Optional base64 or URL of aircraft map image
 * @returns {jQuery} - Wrapper div with cycling display
 */
function AircraftStatusWithMapDiv(aircraftList, mapImageData) {
  const wrapperContainer = $('<div style="margin-top:55px;">').addClass('aircraftStatusWrapper');
  
  // Create the status div
  const statusDiv = AircraftStatusDiv(aircraftList);
  
  // Create map div
  const mapDiv = $('<div>').addClass('aircraftMapDiv').addClass('aircraftStatusDiv').css({
    display: 'none',
    textAlign: 'center'
  });
  
  // Check if map image exists and is not empty
  const hasMap = mapImageData && mapImageData.trim() !== '';
  
  if (hasMap) {
    const mapImg = $('<img>')
      .attr('src', mapImageData)
      .css({
        maxWidth: '100%',
        maxHeight: '500px',
        objectFit: 'contain'
      });
    mapDiv.append(mapImg);
    
    // Add cycling logic
    let showingStatus = true;
    const cycleDuration = 5000; // 5 seconds
    
    const cycleInterval = setInterval(() => {
      if (showingStatus) {
        statusDiv.hide();
        mapDiv.show();
        showingStatus = false;
      } else {
        mapDiv.hide();
        statusDiv.show();
        showingStatus = true;
      }
    }, cycleDuration);
    
    // Store interval ID on the wrapper for cleanup if needed
    wrapperContainer.data('cycleInterval', cycleInterval);
  }
  
  // Append both divs to wrapper
  wrapperContainer.append(statusDiv);
  wrapperContainer.append(mapDiv);
  
  return wrapperContainer;
}

export default AircraftStatusDiv;
export { AircraftStatusWithMapDiv };
