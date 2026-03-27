const crypto = require("crypto");

module.exports = async function handler(req, res) {
  try {
    // ?? your tram stop (Boundary Rd x Racecourse Rd)
    const stopId = req.query.stop || "1322";

    const devId = process.env.PTV_DEV_ID;
    const apiKey = process.env.PTV_API_KEY;

    // ? Check env vars exist
    if (!devId || !apiKey) {
      return res.status(500).json({ error: "Missing API keys" });
    }

    // ? IMPORTANT: devid must be inside the signed string
    const endpoint = `/v3/departures/route_type/1/stop/${stopId}?max_results=5&devid=${devId}`;

    const signature = crypto
      .createHmac("sha1", apiKey)
      .update(endpoint)
      .digest("hex");

    const url = `https://timetableapi.ptv.vic.gov.au${endpoint}&signature=${signature}`;

    const response = await fetch(url);

    const text = await response.text();

    // ? Safe JSON parse (prevents crashes)
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

    // ? Handle API errors properly
    if (!response.ok) {
      return res.status(500).json({
        error: "PTV API error",
        details: data
      });
    }

    // ? Map departures safely
    const trams = (data.departures || []).slice(0, 5).map(dep => {
      const departureTime = new Date(
        dep.estimated_departure_utc || dep.scheduled_departure_utc
      );

      const minutes = Math.round((departureTime - new Date()) / 60000);

      return {
        line: dep.route_id,
        destination: `Direction ${dep.direction_id}`,
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
