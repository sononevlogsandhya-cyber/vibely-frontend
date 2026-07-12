const crypto = require("crypto");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString(); // 6-digit
}

/** Attach a fresh OTP to a user doc (does not save — caller must call user.save()) */
function issueOtp(user, purpose, target) {
  user.otp = {
    code: generateOtp(),
    purpose,
    target,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
  };
  return user.otp.code;
}

/** Returns { ok, message } — does not clear the OTP, caller decides when to clear */
function checkOtp(user, purpose, code) {
  if (!user.otp || !user.otp.code || user.otp.purpose !== purpose) {
    return { ok: false, message: "No OTP was requested for this action" };
  }
  if (user.otp.expiresAt < new Date()) {
    return { ok: false, message: "OTP has expired. Please request a new one" };
  }
  if (user.otp.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: "Too many incorrect attempts. Please request a new OTP" };
  }
  if (user.otp.code !== String(code)) {
    user.otp.attempts += 1;
    return { ok: false, message: "Incorrect OTP" };
  }
  return { ok: true, message: "OTP verified" };
}

function clearOtp(user) {
  user.otp = { code: null, purpose: null, target: "", expiresAt: null, attempts: 0 };
}

module.exports = { generateOtp, issueOtp, checkOtp, clearOtp };
