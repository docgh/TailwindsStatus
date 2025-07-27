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
    if (ac.distance && ac.altitude) {
      location = `Dist: ${ac.distance}, Alt: ${ac.altitude} ft`;
    }
    const locationSpan = $('<span>').addClass('aircraftLocation')
    if (ac.grounded) {
      location = ' (Grounded)';
      locationSpan.css({ color: 'red', fontWeight: 'bold' }); // Highlight grounded aircraft
    }
    if (ac.maintenance) {
      location = ' (Maintenance)';
      locationSpan.css({ color: 'orange', fontWeight: 'bold' }); // Highlight aircraft in maintenance
    } 
    item.append(locationSpan.append(location));
    list.append(item);
  });
  container.append(list);
  return container;
}

export default AircraftStatusDiv;
