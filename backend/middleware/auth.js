// backend/middleware/auth.js
const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const parts = header.split(" ");

  if (parts.length !== 2) {
    return res.status(401).json({ ok: false, message: "Missing token" });
  }

  const [type, token] = parts;

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ ok: false, message: "Missing token" });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev_secret_change_later"
    );

    req.user = payload; // { id, username }
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}

module.exports = auth; // IMPORTANT: exports a FUNCTION
