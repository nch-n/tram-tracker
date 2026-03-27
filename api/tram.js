const crypto = require("crypto");

module.exports = async function handler(req, res) {
  try {
    const stopId = req.query.stop || "3148";

    const devId = process.env.PTV_DEV_ID;
    const apiKey = process.env.PTV_API_KEY;

    if (!devId || !apiKey) {
      return res.status(500).json({ error: "Missing API keys" });
    }

    // ? Correct endpoint for trams + include run data
    const endpoint = `/v3/departures/route_type/1/stop/${stopId}?max_results=5&expand=run&devid=${devId}`;

    const signature = crypto
      .createHmac("sha1", apiKey)
      .update(endpoint)
      .digest("hex");

    const url = `https://timetableapi.ptv.vic.gov.au${endpoint}&signature=${signature}`;

    const response = await fetch(url);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON:", text);
      return res.status(500).json({
        error: "Invalid JSON from PTV",
        raw: text
      });
    }

    if (!response.ok) {
      return res.status(500).json({
        error: "PTV API error",
        details: data
      });
    }

    const departures = Array.isArray(data.departures)
      ? data.departures
      : [];

    const trams = departures.slice(0, 5).map(dep => {
      try {
        // ? ETA
        const departureTime = new Date(
          dep.estimated_departure_utc || dep.scheduled_departure_utc
        );

        const minutes = Math.round(
          (departureTime - new Date()) / 60000
        );

        // ? ROUTE LOOKUP (fix for 887 ? 57)
        const route =
          data.routes?.[dep.route_id] ||
          data.routes?.[String(dep.route_id)];

        const line = route?.route_number || dep.route_id;

        // ? DESTINATION FROM RUNS
        const run =
          data.runs?.[dep.run_id] ||
          data.runs?.[String(dep.run_id)];

        let destination = run?.destination_name || "Unknown";

        // ? CLEAN DESTINATION TEXT
        if (typeof destination === "string") {
          destination = destination
            .split("/")[0]          // remove cross street
            .replace(/#\d+/, "")   // remove stop number
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
