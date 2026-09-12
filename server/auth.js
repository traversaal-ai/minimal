// auth.js — JWT signing + verification middleware.

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "nestpad-dev-secret";
const JWT_EXPIRES_IN = "7d";

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Protected-route middleware: verifies the bearer token and sets req.user = { id, email }.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ error: "unauthorized", message: "Missing or invalid token." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "unauthorized", message: "Missing or invalid token." });
  }
}

module.exports = { signToken, requireAuth, JWT_SECRET };
