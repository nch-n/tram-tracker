const crypto = require("crypto");

module.exports = async function handler(req, res) {
  try {
    // ?? pass ?stop=XXXX or fallback
    const stopId = req.query.stop || "1322";

    const devId = process.env.PTV_DEV_ID;
    const apiKey = process.env.PTV_API_KEY;

    if (!devId || !apiKey) {
      return res.status(500).json({ error: "Missing API keys" });
    }

    // ? route_type=1 (PTV quirk that works)
    const endpoint = `/v3/departures/route_type/0/stop/${stopId}?max_results=5&expand=run&devid=${devId}`;

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
      console.error("PTV returned non-JSON:", text);
      return res.status(500).json({
        error: "PTV returned non-JSON",
        raw: text
      });
    }

    if (!response.ok) {
      return res.status(500).json({
        error: "PTV API error",
        details: data
      });
    }

    const trams = (data.departures || []).slice(0, 5).map(dep => {
      const departureTime = new Date(
        dep.estimated_departure_utc || dep.scheduled_departure_utc
      );

      const minutes = Math.round((departureTime - new Date()) / 60000);

      // ? route lookup (handles array OR object)
      let route;
      if (Array.isArray(data.routes)) {
        route = data.routes.find(r => r.route_id === dep.route_id);
      } else {
        route = data.routes?.[dep.route_id];
      }

      const line = route?.route_number || dep.route_id;

      // ? CRITICAL: destination comes from runs via run_id
      const run = data.runs?.[dep.run_id];
      const destination = run?.destination_name || "Unknown";

      return {
        line,
        destination,
        eta: minutes <= 0 ? "Now" : `${minutes} min`
      };
    });

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
