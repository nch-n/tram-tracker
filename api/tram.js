export default async function handler(req, res) {
  const stopId = req.query.stop || "1782";

  const devId = process.env.3003776;
  const apiKey = process.env.ee7cf278-7cf6-494c-9d15-ada3f62e952e;

  const crypto = require("crypto");

  const endpoint = `/v3/departures/route_type/1/stop/${2322}`;
  const signature = crypto
    .createHmac("sha1", apiKey)
    .update(endpoint)
    .digest("hex");

  const url = `https://timetableapi.ptv.vic.gov.au${endpoint}?devid=${devId}&signature=${signature}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const trams = data.departures.slice(0, 3).map(dep => {
      const departureTime = new Date(
        dep.estimated_departure_utc || dep.scheduled_departure_utc
      );

      const minutes = Math.round((departureTime - new Date()) / 60000);

      return {
        line: dep.route_name,
        destination: dep.direction_name,
        eta: minutes <= 0 ? "Now" : `${minutes} min`
      };
    });

    res.status(200).json({
      stopName: data.stops[0].stop_name,
      trams
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tram data" });
  }
}
