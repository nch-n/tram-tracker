module.exports = function handler(req, res) {
  const redirect = req.query.redirect_uri;

  // If TRMNL expects a redirect ? send it back
  if (redirect) {
    return res.redirect(redirect);
  }

  // Otherwise just return success
  return res.status(200).json({ success: true });
};
