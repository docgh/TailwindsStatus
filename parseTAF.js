// parseTAF.js

    const weatherConditions = {
        'BC': 'Patches of',
        'BL': 'Blowing',
        'DR': 'Low Drifting',
        'DZ': 'Drizzle',
        'FZ': 'Freezing',
        'GR': 'Hail',
        'GS': 'Small Hail/Snow Pellets',
        'HZ': 'Haze',
        'IC': 'Ice Crystals',
        'PL': 'Ice Pellets',
        'MI': 'Shallow',
        'PR': 'Partial',
        'SH': 'Showers',
        'DU': 'Dust',
        'FU': 'Smoke',
        'PY': 'Spray',
        'SA': 'Sand',
        'VA': 'Volcanic Ash',
        'DS': 'Duststorm',
        'SQ': 'Squall',
        'RA': 'Rain',
        'SN': 'Snow',
        'FG': 'Fog',
        'BR': 'Mist',
        'TS': 'Thunderstorm',
        'UP': 'Unknown Precipitation',
        'PO': 'Dust/Sand Whirls',
        'VC': 'Vicinity'
    };

// Parses TAF forecast data from aviationweather.gov and returns JSON

function parseTAF(tafText, settings) {
  // Example TAF: "TAF KPNE 261720Z 2618/2718 32010KT P6SM SCT250 ..."
  const result = {
    raw: tafText,
    station: null,
    issued: null,
    periods: []
  };
  const lines = tafText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return result;

  // First line: TAF KPNE 261720Z 2618/2718 ...
  const header = lines[0].split(' ');
  if (header[0] === 'TAF') {
    result.station = header[1];
    result.issued = header[2];
    result.valid = header[3];
  }

  let tafRaw = lines[0];

  // Each line after header is a forecast period
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Example: "FM262300 32012KT P6SM SCT250"
    const period = {};
    const tokens = line.trim().split(' ');
    if (tokens[0].startsWith('FM')) {
      period.from = tokens[0].substring(2);
      const time = timeToLocal(period.from);
      period.timeLocal = printLocalHourMinute(time);
      if (isFuture(time, settings)) {
        result.until= period.timeLocal;
        break; // Stop parsing if we reach a future period
      }
    } else if (tokens[0].startsWith('TEMPO')) {
      period.tempo = true;
      period.time = tokens[0].substring(5);
      period.timeLocal = printLocalHourMinute(timeToLocal(period.time));
    } else if (tokens[0].startsWith('PROB')) {
      period.prob = tokens[0].substring(4);
      period.probStart = getLocalTime(tokens[1].substring(0, 4));
      period.probEnd = getLocalTime(tokens[1].substring(5, 9));
    } else if (tokens[0].startsWith('TAF')) {
      period.from = result.valid;
    }
    // Parse wind, visibility, clouds
    tokens.forEach((token, index) => {
      let done = false;
      if (/^[0-9]{5}KT$/.test(token)) {
        period.wind = token;
        done = true;
      }
      if (/^(P)?[0-9]+SM$/.test(token)) {
        period.vis = token.replace('SM', '').replace('P', '');
        done = true;
      }
      if (/^(FEW|SCT|BKN|OVC)[0-9]{3}[CB]*$/.test(token)) {
        const coverage = token.substring(0, 3);
        let type = '';
        if (token.includes('CB')) {
          type = 'CB';
        }
        if (token.includes('TCU')) {
          type = 'TCU';
        }
        const base = parseInt(token.substring(3)) * 100;
        if (!period.clouds) period.clouds = [];
        period.clouds.push({ coverage, base, type });
        done = true;
      }
      if (!done && index > 0) {
        period.weather = (period.weather || '') + parseToken(token);
      }
    });
    tafRaw += '\n' + line; // Append to raw TAF text
    result.periods.push(period);
    result.tafRaw = tafRaw; // Store the raw TAF text
  }
  return result;
}

function isFuture(date, settings) {
    const future = new Date().getTime() + ((settings && settings.taf_hours ? settings.taf_hours : 3) * 60 * 60 * 1000);
    const data = new Date(date).getTime();
    return data > future;
}



function parseToken(token) {
  if (token.length < 2) return ''; // Invalid token length
  if (token === 'NOSIG') return 'No significant weather';
  // Parses a single token for weather conditions
  let i = 0;
  let weather = '';
  while (i < token.length) {
    if (token[i] === '-') { weather += 'Light '; i++; continue; }
    if (token[i] === '+') { weather += 'Heavy '; i++; continue; }
    const condition = weatherConditions[token.substring(i, i + 2)];
    if (condition) {
      weather += condition + ' ';
    }
    i += 2; // Move to next condition
  }
    if (!weather) return ''; // No valid weather condition found
    return weather.trim();
}

function timeToLocal(timeStr) {
    const day = timeStr.substring(0, 2); // DD
    const hour = timeStr.substring(2, 4); // HH 
    const min = timeStr.substring(4, 6) || '00'; // MM, default to '00' if not present
    return utcDayHourToDate(day, hour, min);
}

function getLocalTime(dur) {
    if (dur.length == 4) {
        const hour = dur.substring(0, 2);
        const min = dur.substring(2, 4);
        const hourDif = new Date().getTimezoneOffset() / 60;
        const localHour = (Number(hour) - hourDif + 24) % 24;
        return `${String(localHour).padStart(2, '0')}:${min}`;
    }
}

function utcDayHourToDate(day, hour, min) {
  // day: DD (string or number), hour: HH (string or number), min: MM (string or number)
  // Returns a JS Date object in local time
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based
  // If day is before today, assume next month (for TAF periods crossing months)
  let localDay = Number(day);
  if (localDay < now.getUTCDate()) {
    // Next month
    return new Date(Date.UTC(year, month + 1, localDay, hour, min));
  }
  return new Date(Date.UTC(year, month, localDay, hour, min));
}

function printLocalHourMinute(date) {
  // Accepts a JS Date object, returns string in HH:MM local time
  if (!(date instanceof Date)) return '';
  const localDate = new Date(date.getTime());
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}


module.exports = { parseTAF, weatherConditions };
