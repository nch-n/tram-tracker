const crypto = require("crypto");

// simple in-memory cache (persists across Vercel invocations briefly)
const routeCache = {};

async function getRoute(routeId, devId, apiKey) {
  if (routeCache[routeId]) return routeCache[routeId];

  const endpoint = `/v3/routes/${routeId}?devid=${devId}`;

  const signature = crypto
    .createHmac("sha1", apiKey)
    .update(endpoint)
    .digest("hex");

  const url = `https://timetableapi.ptv.vic.gov.au${endpoint}&signature=${signature}`;

  const res = await fetch(url);
  const data = await res.json();

  const routeNumber = data?.route?.route_number;

  routeCache[routeId] = routeNumber;

  return routeNumber;
}

module.exports = async function handler(req, res) {
  try {
    const stopId = req.query.stop || "3148";

    const devId = process.env.PTV_DEV_ID;
    const apiKey = process.env.PTV_API_KEY;

    if (!devId || !apiKey) {
      return res.status(500).json({ error: "Missing API keys" });
    }

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

    const trams = await Promise.all(
      departures.slice(0, 5).map(async dep => {
        try {
          const departureTime = new Date(
            dep.estimated_departure_utc || dep.scheduled_departure_utc
          );

          const minutes = Math.round(
            (departureTime - new Date()) / 60000
          );

          // ? REAL route lookup
          const line =
            (await getRoute(dep.route_id, devId, apiKey)) ||
            dep.route_id;

          // ? destination from runs
          const run =
            data.runs?.[dep.run_id] ||
            data.runs?.[String(dep.run_id)];

          let destination = run?.destination_name || "Unknown";

          if (typeof destination === "string") {
            destination = destination
              .split("/")[0]
              .replace(/#\d+/, "")
              .replace(" Railway Station", "")
              .replace(" Street", " St")
              .replace(" Avenue", " Ave")
              .trim();
          }

          return {
            line,
            destination,
            eta: minutes <= 0 ? "Now" : `${minutes} min`
          };

        } catch (err) {
          console.error("Mapping error:", err);
          return null;
        }
      })
    );

    return res.status(200).json({
      stopId,
      tramCount: trams.filter(Boolean).length,
      trams: trams.filter(Boolean)
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};
