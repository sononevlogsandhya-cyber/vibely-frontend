const mongoose = require("mongoose");

// One document per active login (device/browser). Powers:
// - Login Activity (history of logins)
// - Device Management (list + revoke)
// - Multiple Account Login (each account's active token is tied to a session)
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenId: { type: String, required: true, unique: true }, // jti embedded in the JWT
    deviceLabel: { type: String, default: "Unknown device" }, // e.g. "Chrome on Windows"
    browser: { type: String, default: "" },
    os: { type: String, default: "" },
    deviceType: { type: String, default: "" }, // mobile / desktop / tablet
    ip: { type: String, default: "" },
    location: { type: String, default: "" }, // best-effort, filled from IP lookup if available
    isCurrent: { type: Boolean, default: true },
    lastActiveAt: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1, revoked: 1 });

module.exports = mongoose.model("Session", sessionSchema);
