const express = require("express");
const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

const User = require("../models/User");
const Session = require("../models/Session");
const auth = require("../middleware/auth");
const { sendEmail, otpEmailTemplate } = require("../utils/email");
const { issueOtp, checkOtp, clearOtp } = require("../utils/otp");
const { generatePlainCodes, hashCodes } = require("../utils/backupCodes");

const router = express.Router();

/* =========================================================================
   ACCOUNT CENTER — overview of everything in one call, powers the hub page
   ========================================================================= */
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const activeSessionCount = await Session.countDocuments({ user: user._id, revoked: false });

    res.json({
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      phoneVerifyGmail: user.phoneVerifyGmail,
      birthday: user.birthday,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      birthdayVerified: user.birthdayVerified,
      identityVerification: user.identityVerification,
      twoFactorEnabled: user.twoFactor?.enabled || false,
      backupCodesRemaining: (user.twoFactor?.backupCodes || []).filter((c) => !c.used).length,
      passkeyCount: (user.passkeys || []).length,
      connectedAccounts: {
        facebook: user.connectedAccounts?.facebook || { connected: false },
        threads: user.connectedAccounts?.threads || { connected: false },
      },
      language: user.language,
      accessibility: user.accessibility,
      activeSessionCount,
      accountStatus: user.accountStatus,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   EMAIL VERIFICATION
   ========================================================================= */
router.post("/verify-email/send", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.emailVerified) return res.status(400).json({ message: "Email already verified" });

    const code = issueOtp(user, "email_verify", user.email);
    await user.save();
    await sendEmail({
      to: user.email,
      subject: "Verify your Vibely email",
      html: otpEmailTemplate({ code, purposeLabel: "email verification" }),
      text: `Your Vibely email verification code is ${code}`,
    });
    res.json({ message: "Verification code sent to your email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/verify-email/confirm", auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.userId);
    const result = checkOtp(user, "email_verify", code);
    if (!result.ok) {
      await user.save();
      return res.status(400).json({ message: result.message });
    }
    user.emailVerified = true;
    clearOtp(user);
    await user.save();
    res.json({ message: "Email verified successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   PHONE VERIFICATION
   NOTE: No SMS provider configured yet (Twilio/MSG91 pending). For now this
   sends the OTP to the user's verified email as a fallback so the feature
   is fully testable end-to-end. Once you add SMS credentials, swap the
   sendEmail() call below for a real sendSms() call in utils/sms.js.
   ========================================================================= */
router.post("/verify-phone/send", auth, async (req, res) => {
  try {
    const { phone, gmail } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number is required" });

    // If they supplied a Gmail address to receive the OTP, validate it looks like one.
    const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (gmail && !gmailPattern.test(gmail.trim())) {
      return res.status(400).json({ message: "Please enter a valid Gmail address (e.g. name@gmail.com)" });
    }

    const user = await User.findById(req.userId);
    user.phone = phone;
    if (gmail) user.phoneVerifyGmail = gmail.trim().toLowerCase();

    const code = issueOtp(user, "phone_verify", phone);
    await user.save();

    // Prefer the Gmail address the user just typed in; otherwise fall back to their account email.
    const sendTo = user.phoneVerifyGmail || user.email;

    // TEMP fallback (email) until SMS provider is configured:
    await sendEmail({
      to: sendTo,
      subject: "Verify your Vibely phone number (email fallback)",
      html: otpEmailTemplate({ code, purposeLabel: `phone verification for ${phone}` }),
      text: `Your Vibely phone verification code is ${code}`,
    });

    res.json({
      message: `SMS isn't set up yet, so the code was sent to ${sendTo} instead. Enter it below.`,
      smsPending: true,
      sentTo: sendTo,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/verify-phone/confirm", auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.userId);
    const result = checkOtp(user, "phone_verify", code);
    if (!result.ok) {
      await user.save();
      return res.status(400).json({ message: result.message });
    }
    user.phoneVerified = true;
    clearOtp(user);
    await user.save();
    res.json({ message: "Phone number verified successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   BIRTHDAY VERIFICATION (simple age-gate, 13+ like most social apps)
   ========================================================================= */
router.post("/verify-birthday", auth, async (req, res) => {
  try {
    const { birthday } = req.body; // "YYYY-MM-DD"
    if (!birthday) return res.status(400).json({ message: "Birthday is required" });

    const dob = new Date(birthday);
    if (isNaN(dob.getTime())) return res.status(400).json({ message: "Invalid date" });

    const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 13) {
      return res.status(400).json({ message: "You must be at least 13 years old to use Vibely" });
    }

    const user = await User.findById(req.userId);
    user.birthday = dob;
    user.birthdayVerified = true;
    await user.save();
    res.json({ message: "Birthday saved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   IDENTITY VERIFICATION (KYC) — skeleton
   Real verification needs a 3rd-party vendor (DigiLocker/Aadhaar eKYC,
   Signzy, HyperVerge, etc). This stores the submission as "pending" for an
   admin/vendor webhook to later mark verified/rejected.
   ========================================================================= */
router.post("/verify-identity/submit", auth, async (req, res) => {
  try {
    const { documentType, documentNumber } = req.body;
    if (!documentType || !documentNumber) {
      return res.status(400).json({ message: "Document type and number are required" });
    }
    const masked = documentNumber.slice(-4).padStart(documentNumber.length, "•");

    const user = await User.findById(req.userId);
    user.identityVerification = {
      status: "pending",
      documentType,
      documentNumberMasked: masked,
      submittedAt: new Date(),
      reviewedAt: null,
      note: "Awaiting manual/vendor review",
    };
    await user.save();
    res.json({ message: "Submitted for verification. This usually takes 1-3 days.", status: "pending" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   PASSWORD RESET (public — user is logged out)
   ========================================================================= */
router.post("/password/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    // Always respond success to avoid leaking which emails exist
    if (!user) return res.json({ message: "If that email exists, a reset code has been sent" });

    const code = issueOtp(user, "password_reset", user.email);
    await user.save();
    await sendEmail({
      to: user.email,
      subject: "Reset your Vibely password",
      html: otpEmailTemplate({ code, purposeLabel: "password reset" }),
      text: `Your Vibely password reset code is ${code}`,
    });
    res.json({ message: "If that email exists, a reset code has been sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/password/reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Email, code and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: "Invalid request" });

    const result = checkOtp(user, "password_reset", code);
    if (!result.ok) {
      await user.save();
      return res.status(400).json({ message: result.message });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    clearOtp(user);
    await user.save();

    // Security best practice: log out every device after a password reset
    await Session.updateMany({ user: user._id, revoked: false }, { revoked: true, revokedAt: new Date() });

    res.json({ message: "Password reset successfully. Please log in again." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   ACCOUNT RECOVERY (logged out, e.g. lost 2FA device + forgot password)
   Sends a recovery OTP to the registered email; on success, disables 2FA so
   the user can log back in, and revokes all sessions.
   ========================================================================= */
router.post("/recovery/start", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user) return res.json({ message: "If that account exists, a recovery code has been sent" });

    const code = issueOtp(user, "account_recovery", user.email);
    await user.save();
    await sendEmail({
      to: user.email,
      subject: "Vibely account recovery",
      html: otpEmailTemplate({ code, purposeLabel: "account recovery" }),
      text: `Your Vibely account recovery code is ${code}`,
    });
    res.json({ message: "If that account exists, a recovery code has been sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/recovery/confirm", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user) return res.status(400).json({ message: "Invalid request" });

    const result = checkOtp(user, "account_recovery", code);
    if (!result.ok) {
      await user.save();
      return res.status(400).json({ message: result.message });
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    // Recovery disables 2FA (device was lost) — user can re-enable once back in
    user.twoFactor.enabled = false;
    user.twoFactor.secret = "";
    clearOtp(user);
    await user.save();
    await Session.updateMany({ user: user._id, revoked: false }, { revoked: true, revokedAt: new Date() });

    res.json({ message: "Account recovered. 2FA was disabled for safety — you can re-enable it after logging in." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   TWO-FACTOR AUTHENTICATION (TOTP) + BACKUP CODES
   ========================================================================= */
router.post("/2fa/setup", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.twoFactor?.enabled) return res.status(400).json({ message: "2FA is already enabled" });

    const secret = speakeasy.generateSecret({
      name: `Vibely (${user.username})`,
    });
    user.twoFactor.pendingSecret = secret.base32;
    await user.save();

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ qrDataUrl, manualEntryKey: secret.base32 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/2fa/confirm", auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.userId);
    if (!user.twoFactor?.pendingSecret) {
      return res.status(400).json({ message: "No 2FA setup in progress. Start setup first" });
    }

    const ok = speakeasy.totp.verify({
      secret: user.twoFactor.pendingSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });
    if (!ok) return res.status(400).json({ message: "Incorrect code, please try again" });

    user.twoFactor.secret = user.twoFactor.pendingSecret;
    user.twoFactor.pendingSecret = "";
    user.twoFactor.enabled = true;

    const plainCodes = generatePlainCodes(10);
    user.twoFactor.backupCodes = await hashCodes(plainCodes);
    await user.save();

    res.json({ message: "2FA enabled successfully", backupCodes: plainCodes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/2fa/disable", auth, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.userId);
    const match = await bcrypt.compare(password || "", user.password);
    if (!match) return res.status(400).json({ message: "Incorrect password" });

    user.twoFactor = { enabled: false, secret: "", pendingSecret: "", backupCodes: [] };
    await user.save();
    res.json({ message: "2FA disabled" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/2fa/backup-codes/regenerate", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user.twoFactor?.enabled) return res.status(400).json({ message: "2FA is not enabled" });

    const plainCodes = generatePlainCodes(10);
    user.twoFactor.backupCodes = await hashCodes(plainCodes);
    await user.save();
    res.json({ backupCodes: plainCodes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   LOGIN ACTIVITY + DEVICE MANAGEMENT
   ========================================================================= */
router.get("/sessions", auth, async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.userId }).sort({ lastActiveAt: -1 });
    res.json(
      sessions.map((s) => ({
        _id: s._id,
        deviceLabel: s.deviceLabel,
        browser: s.browser,
        os: s.os,
        deviceType: s.deviceType,
        ip: s.ip,
        location: s.location,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        revoked: s.revoked,
        isCurrent: s.tokenId === req.tokenId,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/sessions/:id", auth, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, user: req.userId });
    if (!session) return res.status(404).json({ message: "Session not found" });
    session.revoked = true;
    session.revokedAt = new Date();
    await session.save();
    res.json({ message: "Device logged out" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/sessions/logout-others", auth, async (req, res) => {
  try {
    await Session.updateMany(
      { user: req.userId, revoked: false, tokenId: { $ne: req.tokenId } },
      { revoked: true, revokedAt: new Date() }
    );
    res.json({ message: "All other devices have been logged out" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   CONNECTED ACCOUNTS (Meta Account Center style)
   Real Facebook/Threads login requires your own Meta Developer App
   (App ID + App Secret, OAuth redirect approved by Meta). These endpoints
   store the connection once your frontend completes Meta's OAuth flow and
   sends back the profile info — swap the TODO with a real token exchange.
   ========================================================================= */
router.post("/connected/facebook", auth, async (req, res) => {
  try {
    // TODO: verify req.body.accessToken with Meta's Graph API before trusting this
    const { facebookId, name } = req.body;
    if (!facebookId) return res.status(400).json({ message: "facebookId is required" });

    const user = await User.findById(req.userId);
    user.connectedAccounts.facebook = { connected: true, facebookId, name: name || "", connectedAt: new Date() };
    await user.save();
    res.json({ message: "Facebook account connected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/connected/facebook", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.connectedAccounts.facebook = { connected: false, facebookId: "", name: "", connectedAt: null };
    await user.save();
    res.json({ message: "Facebook account disconnected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/connected/threads", auth, async (req, res) => {
  try {
    const { threadsId, name } = req.body;
    if (!threadsId) return res.status(400).json({ message: "threadsId is required" });

    const user = await User.findById(req.userId);
    user.connectedAccounts.threads = { connected: true, threadsId, name: name || "", connectedAt: new Date() };
    await user.save();
    res.json({ message: "Threads account connected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/connected/threads", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.connectedAccounts.threads = { connected: false, threadsId: "", name: "", connectedAt: null };
    await user.save();
    res.json({ message: "Threads account disconnected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================================
   LANGUAGE + ACCESSIBILITY
   ========================================================================= */
router.put("/language", auth, async (req, res) => {
  try {
    const { language } = req.body;
    const allowed = ["en", "hi", "mr", "ta", "te", "bn", "gu", "kn", "ml", "pa", "ur"];
    if (!allowed.includes(language)) {
      return res.status(400).json({ message: "Unsupported language" });
    }
    const user = await User.findByIdAndUpdate(req.userId, { language }, { new: true });
    res.json({ language: user.language });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/accessibility", auth, async (req, res) => {
  try {
    const { fontSize, highContrast, reduceMotion, screenReaderOptimized } = req.body;
    const user = await User.findById(req.userId);

    if (fontSize) user.accessibility.fontSize = fontSize;
    if (typeof highContrast === "boolean") user.accessibility.highContrast = highContrast;
    if (typeof reduceMotion === "boolean") user.accessibility.reduceMotion = reduceMotion;
    if (typeof screenReaderOptimized === "boolean")
      user.accessibility.screenReaderOptimized = screenReaderOptimized;

    await user.save();
    res.json({ accessibility: user.accessibility });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
