const crypto = require("crypto");

// ?? caches (persist briefly on Vercel)
const routeCache = {};
const directionCache = {};

// --------------------
// FETCH ROUTE
// --------------------
async function fetchRoute(routeId, devId, apiKey) {
  if (routeCache[routeId]) return routeCache[routeId];

  const endpoint = `/v3/routes/${routeId}?devid=${devId}`;

  const signature = crypto
    .createHmac("sha1", apiKey)
    .update(endpoint)
    .digest("hex");

  const url = `https://timetableapi.ptv.vic.gov.au${endpoint}&signature=${signature}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const route = data?.route || null;
    routeCache[routeId] = route;

    return route;
  } catch (err) {
    console.error("Route fetch error:", err);
    return null;
  }
}

// --------------------
// FETCH DIRECTIONS
// --------------------
async function fetchDirections(routeId, devId, apiKey) {
  if (directionCache[routeId]) return directionCache[routeId];

  const endpoint = `/v3/directions/route/${routeId}?route_type=1&devid=${devId}`;

  const signature = crypto
    .createHmac("sha1", apiKey)
    .update(endpoint)
    .digest("hex");

  const url = `https://timetableapi.ptv.vic.gov.au${endpoint}&signature=${signature}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const directions = data?.directions || [];
    directionCache[routeId] = directions;

    return directions;
  } catch (err) {
    console.error("Direction fetch error:", err);
    return [];
  }
}

// --------------------
// MAIN HANDLER
// --------------------
module.exports = async function handler(req, res) {
  try {
    const stopId = req.query.stop || "3148";

    const devId = process.env.PTV_DEV_ID;
    const apiKey = process.env.PTV_API_KEY;

    if (!devId || !apiKey) {
      return res.status(500).json({ error: "Missing API keys" });
    }

    // ? departures
    const endpoint = `/v3/departures/route_type/1/stop/${stopId}?max_results=5&expand=run&devid=${devId}`;

    const signature = crypto
      .createHmac("sha1", apiKey)
      .update(endpoint)
      .digest("hex");

    const url = `https://timetableapi.ptv.vic.gov.au${endpoint}&signature=${signature}`;

    const response = await fetch(url);
    const data = await response.json();

    const departures = Array.isArray(data.departures)
      ? data.departures
      : [];

    // ?? unique route IDs
    const routeIds = [...new Set(departures.map(d => d.route_id))];

    const routeMap = {};
    const directionMap = {};

    // ?? fetch route + direction data
    await Promise.all(
      routeIds.map(async routeId => {
        const [route, directions] = await Promise.all([
          fetchRoute(routeId, devId, apiKey),
          fetchDirections(routeId, devId, apiKey)
        ]);

        routeMap[routeId] = route;
        directionMap[routeId] = directions;
      })
    );

    // ?? build tram list
    const trams = departures.slice(0, 5).map(dep => {
      const departureTime = new Date(
        dep.estimated_departure_utc || dep.scheduled_departure_utc
      );

      const minutes = Math.round(
        (departureTime - new Date()) / 60000
      );

      const route = routeMap[dep.route_id];
      const directions = directionMap[dep.route_id] || [];

      const direction = directions.find(
        d => d.direction_id === dep.direction_id
      );

      const line = route?.route_number || dep.route_id;

      let destination = direction?.direction_name || "Unknown";

      // ? clean destination
      destination = destination
        .replace(" Railway Station", "")
        .replace(" Street", " St")
        .replace(" Avenue", " Ave")
        .trim();

      // ? nicer ETA labels
      let eta = `${minutes} min`;
      if (minutes <= 0) eta = "Now";
      else if (minutes <= 1) eta = "?? Now";
      else if (minutes <= 3) eta = "Soon";

      return { line, destination, eta };
    });

    // ?? TRMNL DISPLAY FORMAT
return res.status(200).json({
  items: trams.map((t, i) => ({
    title: i === 0
      ? `?? ${t.line}  ${t.destination}`
      : `${t.line}  ${t.destination}`,
    right: t.eta
  }))
});

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};
