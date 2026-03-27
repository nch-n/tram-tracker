export default function handler(req, res) {
  const redirect = req.query.redirect_uri;

  // send user back to TRMNL immediately
  res.redirect(redirect);
}
