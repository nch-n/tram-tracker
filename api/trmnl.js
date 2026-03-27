module.exports = async function handler(req, res) {
  const { method, query } = req;

  // ------------------------
  // INSTALL FLOW
  // ------------------------
  if (query.installation_callback_url) {
    const redirectUrl = new URL(query.installation_callback_url);

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
  // CONFIG / VIEW (IMPORTANT FIX)
  // ------------------------
  if (query.uuid && query.jwt) {
    res.setHeader("Content-Type", "text/html");

    return res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h2>?? Tram Tracker</h2>
          <p>This plugin is active.</p>
          <p>No configuration needed.</p>
        </body>
      </html>
    `);
  }

  // ------------------------
  // DEFAULT
  // ------------------------
  return res.status(200).json({ ok: true });
};
