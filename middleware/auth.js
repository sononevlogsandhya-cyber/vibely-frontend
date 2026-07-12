const jwt = require("jsonwebtoken");
const Session = require("../models/Session");

module.exports = async function auth(req, res, next) {
  const header = req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.tokenId = decoded.jti;

    // If this token maps to a session that's been revoked (e.g. via Device
    // Management "log out this device"), reject it even though the JWT
    // itself is still cryptographically valid.
    if (decoded.jti) {
      const session = await Session.findOne({ tokenId: decoded.jti });
      if (session && session.revoked) {
        return res.status(401).json({ message: "Session has been logged out. Please log in again" });
      }
      if (session) {
        session.lastActiveAt = new Date();
        session.save().catch(() => {});
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token is not valid" });
  }
};
