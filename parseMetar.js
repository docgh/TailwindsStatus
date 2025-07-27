const weatherAbr = {
  '-': 'light intensity',
  '+': 'heavy intensity',
  VC: 'in the vicinity',
  MI: 'shallow',
  PR: 'partial',
  BC: 'patches',
  DR: 'low drifting',
  BL: 'blowing',
  SH: 'showers',
  TS: 'thunderstorm',
  FZ: 'freezing',
  RA: 'rain',
  DZ: 'drizzle',
  SN: 'snow',
  SG: 'snow grains',
  IC: 'ice crystals',
  PL: 'ice pellets',
  GR: 'hail',
  GS: 'small hail',
  UP: 'unknown precipitation',
  FG: 'fog',
  VA: 'volcanic ash',
  BR: 'mist',
  HZ: 'haze',
  DU: 'widespread dust',
  FU: 'smoke',
  SA: 'sand',
  PY: 'spray',
  SQ: 'squall',
  PO: 'dust or sand whirls',
  DS: 'duststorm',
  SS: 'sandstorm',
  FC: 'funnel cloud',
  LTG: 'lightning',
  TCU: 'towering cumulus',
  TWR: 'towering',
  CB: 'cumulonimbus',
  MIFG: 'TEST',
  BCFG: 'TEST',
  PRFG: 'TEST',
  REBLSN: 'Moderate/heavy blowing snow (visibility significantly reduced)reduced',
  REDS: 'Dust Storm',
  REFC: 'Funnel Cloud',
  REFZDZ: 'Freezing Drizzle',
  REFZRA: 'Freezing Rain',
  REGP: 'Moderate/heavy snow pellets',
  REGR: 'Moderate/heavy hail',
  REGS: 'Moderate/heavy small hail',
  REIC: 'Moderate/heavy ice crystals',
  REPL: 'Moderate/heavy ice pellets',
  RERA: 'Moderate/heavy rain',
  RESG: 'Moderate/heavy snow grains',
  RESHGR: 'Moderate/heavy hail showers',
  RESHGS: 'Moderate/heavy small hail showers',
  RESHPL: 'Moderate/heavy ice pellet showers',
  RESHRA: 'Moderate/heavy rain showers',
  RESHSN: 'Moderate/heavy snow showers',
  RESN: 'Moderate/heavy snow',
  RESS: 'Sandstorm',
  RETS: 'Thunderstorm',
  REUP: 'Unidentified precipitation (AUTO obs. only)',
  REVA: 'Volcanic Ash',
};

function parseMetar(metar) {
  // Example METAR: "KPNE 261554Z 32012KT 10SM FEW050 SCT250 27/13 A3007 RMK AO2 SLP181 T02720128"
  const result = {
    wind: null,
    dir: null,
    speed: null,
    gust: null,
    vis: null,
    clouds: [],
  };
  const parts = metar.split(" ");
  // Wind: e.g. 32012KT or 32012G18KT
  const windRegex = /([0-9]{3})([0-9]{2,3})(G([0-9]{2,3}))?KT/;
  for (let part of parts) {
    if (windRegex.test(part)) {
      const match = part.match(windRegex);
      result.wind = part;
      result.dir = match[1];
      result.speed = match[2];
      result.gust = match[4] || null;
      continue;
    }
    if (/^VRB/.test(part)) {
      // Handle variable wind direction
      result.wind = "VRB";
      result.dir = "VRB";
      result.speed = part.replace("VRB", "").replace("KT", "");
      continue;
    }
    // Visibility: e.g. 10SM
    if (/^[0-9]+SM$/.test(part)) {
      result.vis = part.replace("SM", "");
      continue;
    }
    // Clouds: e.g. FEW050, SCT250, BKN100, OVC200
    if (/^(FEW|SCT|BKN|OVC)[0-9]{3,}[A-Z]*$/.test(part)) {
      const coverage = part.substring(0, 3);
      let clouds = part.substring(3);
      let type = '';
      if (/[^0-9]/.test(clouds)) {
        if (clouds.includes('CB')) {
          type = 'CB';
        }
        if (clouds.includes('TCU')) {
          type = 'TCU';
        }
      }
      const base = parseInt(clouds) * 100; // in feet
      result.clouds.push({ coverage, base, type });
      continue;
    }
    let other = '';
    Object.keys(weatherAbr).forEach(el => {
        if (part.includes(el)) {
            other += (weatherAbr[el] + ' ');
        }
    });
    if (other) {
      result.weather = result.weather ? result.weather + ' ' + other : other;
    }

  }
  return result;
}

module.exports = parseMetar;
