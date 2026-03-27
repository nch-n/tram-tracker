module.exports = async function handler(req, res) {
  const { method, query } = req;

  // ------------------------
  // INSTALL FLOW
  // ------------------------
  if (query.redirect_uri) {
    const redirectUrl = new URL(query.redirect_uri);

    // fake install data
    redirectUrl.searchParams.set("external_user_id", "tram-user");
    redirectUrl.searchParams.set("access_token", "tram-token");

    return res.redirect(redirectUrl.toString());
  }

  // ------------------------
  // WEBHOOK (POST)
  // ------------------------
  if (method === "POST") {
    return res.status(200).json({ success: true });
  }

  // ------------------------
  // MANAGEMENT PAGE
  // ------------------------
  res.setHeader("Content-Type", "text/html");

  return res.send(`
    <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h1>?? Tram Tracker Plugin</h1>
        <p>Your plugin is installed and working.</p>
      </body>
    </html>
  `);
};
