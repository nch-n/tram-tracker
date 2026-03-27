module.exports = async function handler(req, res) {
  const { method, query } = req;

  // ------------------------
  // INSTALL FLOW
  // ------------------------
  if (query.redirect_uri) {
    const redirectUrl = new URL(query.redirect_uri);

    // ? REQUIRED fields for TRMNL
    redirectUrl.searchParams.set("external_user_id", "tram-user-1");
    redirectUrl.searchParams.set("api_key", "tram-demo-key");

    return res.redirect(redirectUrl.toString());
  }

  // ------------------------
  // WEBHOOK
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
        <h1>?? Tram Tracker</h1>
        <p>Plugin installed successfully.</p>
      </body>
    </html>
  `);
};
