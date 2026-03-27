const crypto = require("crypto");

module.exports = async function handler(req, res) {
  try {
    const stopId = req.query.stop || "1782";

    const devId = process.env.PTV_DEV_ID;
    const apiKey = process.env.PTV_API_KEY;

    if (!devId || !apiKey) {
      return res.status(500).json({ error: "Missing API keys" });
    }

    const endpoint = `/v3/departures/route_type/1/stop/${stopId}?devid=${devId}`;

    const signature = crypto
      .createHmac("sha1", apiKey)
      .update(endpoint)
      .digest("hex");

    const url = `https://timetableapi.ptv.vic.gov.au${endpoint}&signature=${signature}`;

    const response = await fetch(url);

const text = await response.text();
console.log("PTV RAW:", text);

if (!response.ok) {
  throw new Error(text);
}

const data = JSON.parse(text);

    const data = await response.json();

const trams = data.departures.slice(0, 5).map(dep => {
  const departureTime = new Date(
    dep.estimated_departure_utc || dep.scheduled_departure_utc
  );

  const minutes = Math.round((departureTime - new Date()) / 60000);

  return {
    line: dep.route_id,
    destination: dep.direction_id,
    eta: minutes <= 0 ? "Now" : `${minutes} min`
  };
});

    return res.status(200).json({
stopName: data.departures?.[0]?.stop_id || "Unknown stop",
      trams
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};
