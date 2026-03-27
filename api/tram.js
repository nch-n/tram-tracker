const crypto = require("crypto");

// ?? in-memory cache (persists across warm invocations)
const routeCache = {};

async function fetchRoute(routeId, devId, apiKey) {
  // return cached if exists
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

module.exports = async function handler(req, res) {
  try {
    const stopId = req.query.stop || "3148";

    const devId = process.env.PTV_DEV_ID;
    const apiKey = process.env.PTV_API_KEY;

    if (!devId || !apiKey) {
      return res.status(500).json({ error: "Missing API keys" });
    }

    // ? departures call (with runs)
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

    // ?? STEP 1: collect unique route_ids
    const routeIds = [
      ...new Set(departures.map(d => d.route_id))
    ];

    // ?? STEP 2: resolve routes (from API OR cache)
    const routeMap = {};

    await Promise.all(
      routeIds.map(async routeId => {
        // try departures data first
        let route = null;

        if (data.routes) {
          const routesArray = Array.isArray(data.routes)
            ? data.routes
            : Object.values(data.routes);

          route = routesArray.find(r => r.route_id === routeId);
        }

        // fallback to API if missing
        if (!route) {
          route = await fetchRoute(routeId, devId, apiKey);
        }

        routeMap[routeId] = route;
      })
    );

    // ?? STEP 3: build response
    const trams = departures.slice(0, 5).map(dep => {
      try {
        const departureTime = new Date(
          dep.estimated_departure_utc || dep.scheduled_departure_utc
        );

        const minutes = Math.round(
          (departureTime - new Date()) / 60000
        );

        const route = routeMap[dep.route_id];

        const line = route?.route_number || dep.route_id;

        // ? direction-aware destination from route_name
let destination = "Unknown";

if (route?.route_name) {
  const parts = route.route_name.split(" - ");

  if (parts.length === 2) {
    const [endA, endB] = parts;

    // ? handle direction_id safely
    if (dep.direction_id === 0) {
      destination = endB;
    } else if (dep.direction_id === 1) {
      destination = endA;
    } else {
      // fallback if weird direction_id
      destination = endA;
    }
  }
}
        // ? clean text
        destination = destination
          .replace(" Railway Station", "")
          .replace(" Street", " St")
          .replace(" Avenue", " Ave")
          .trim();

        return {
          line,
          destination,
          eta: minutes <= 0 ? "Now" : `${minutes} min`
        };

      } catch (err) {
        console.error("Mapping error:", err);
        return null;
      }
    }).filter(Boolean);

    return res.status(200).json({
      stopId,
      tramCount: trams.length,
      trams
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};
