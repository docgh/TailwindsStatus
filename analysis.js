// analysis.js

function windComponents(runwayHeading, windDir, windSpeed) {
  // All angles in degrees, windSpeed in knots
  // Returns { crosswind, headwind }
  // runwayHeading and windDir should be numbers (e.g. 90 for east)
  // windSpeed should be a number
  // Formula: angle = windDir - runwayHeading
  // headwind = windSpeed * cos(angle)
  // crosswind = windSpeed * sin(angle)
  if (windDir === "VRB" || windSpeed <= 0) {
    return { headwind: 0, crosswind: 0 };
  }
  const toRadians = (deg) => deg * (Math.PI / 180);
  let angle = windDir - runwayHeading;
  // Normalize angle to -180..180
  angle = ((angle + 180) % 360) - 180;
  const rad = toRadians(angle);
  const headwind = Math.round(windSpeed * Math.cos(rad));
  const crosswind = Math.round(windSpeed * Math.sin(rad));
  return { headwind, crosswind };
}

function unsigned(val) {
  // Returns the absolute value of a number
  return Math.abs(val);
}

function getColor(data) {
  const ceiling = data.clouds.find((c) => c.type !== "FEW") || { base: 999999 };
  if (
    Math.max(data.headwind, data.gust_headwind) > data.headwind_max ||
    Math.max(unsigned(data.crosswind), unsigned(data.gust_crosswind)) > data.crosswind_max ||
    data.cloud_min > ceiling.base ||
    data.vis < data.vis_min
  ) {
    return "red";
  }
  if (
    Math.max(data.headwind, data.gust_headwind) > data.headwind_caution ||
    Math.max(unsigned(data.crosswind), unsigned(data.gust_crosswind)) > data.crosswind_caution ||
    data.cloud_caution > ceiling.base ||
    data.vis < data.vis_caution
  ) {
    return "yellow";
  }
  return "green";
}

function getRunwayData(data, settings) {
  // Example data: { runway: '27L', wind: { dir: 320, speed: 12, gust: 18 } }
  const runwayHeading = parseInt(data.runway) * 10; // Convert e.g. '27' to 270 degrees
  const windDir = data.wind.dir;
  const windSpeed = data.wind.speed;
  const components = windComponents(runwayHeading, windDir, windSpeed);
  const gusts = windComponents(runwayHeading, windDir, data.wind.gust || 0);
  const runway = {
    runway: data.runway,
    headwind: components.headwind,
    crosswind: components.crosswind,
    gust_headwind: gusts.headwind,
    gust_crosswind: gusts.crosswind,
  };
  if (components.headwind >= 0) {
    runway.student = getColor({
      clouds: data.clouds,
      headwind: components.headwind,
      crosswind: components.crosswind,
      gust_headwind: gusts.headwind,
      gust_crosswind: gusts.crosswind,
      headwind_caution: settings.student_wind_caution,
      crosswind_caution: settings.student_wind_x_caution,
      cloud_caution: settings.student_cloud_caution,
      headwind_max: settings.student_wind_max,
      crosswind_max: settings.student_wind_x_max,
      cloud_min: settings.student_cloud_min,
      vis: data.vis,
      vis_caution: settings.student_vis_caution,
      vis_min: settings.student_vis_min,
    });
    runway.vfr = getColor({
      clouds: data.clouds,
      headwind: components.headwind,
      crosswind: components.crosswind,
      gust_headwind: gusts.headwind,
      gust_crosswind: gusts.crosswind,
      headwind_caution: settings.vfr_wind_caution,
      crosswind_caution: settings.vfr_wind_x_caution,
      cloud_caution: settings.vfr_cloud_caution,
      headwind_max: settings.vfr_wind_max,
      crosswind_max: settings.vfr_wind_x_max,
      cloud_min: settings.vfr_cloud_min,
      vis: data.vis,
      vis_caution: settings.vfr_vis_caution,
      vis_min: settings.vfr_vis_min,
    });
    runway.ifr = getColor({
      clouds: data.clouds,
      headwind: components.headwind,
      crosswind: components.crosswind,
      gust_headwind: gusts.headwind,
      gust_crosswind: gusts.crosswind,
      headwind_caution: settings.ifr_wind_caution,
      crosswind_caution: settings.ifr_wind_x_caution,
      cloud_caution: settings.ifr_cloud_caution,
      headwind_max: settings.ifr_wind_max,
      crosswind_max: settings.ifr_wind_x_max,
      cloud_min: settings.ifr_cloud_min,
      vis: data.vis,
      vis_caution: settings.ifr_vis_caution,
      vis_min: settings.ifr_vis_min,
    });
    return runway;
  }
  return [];
}

module.exports = { windComponents, getColor, getRunwayData };
