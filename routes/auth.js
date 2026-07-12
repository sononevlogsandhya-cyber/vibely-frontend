const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { v4: uuidv4 } = require("uuid");

const User = require("../models/User");
const Session = require("../models/Session");
const auth = require("../middleware/auth");
const { sendEmail, otpEmailTemplate } = require("../utils/email");
const { issueOtp } = require("../utils/otp");
const { verifyAndConsumeCode } = require("../utils/backupCodes");
const { describeRequest } = require("../utils/device");

const router = express.Router();

function signToken(userId, jti) {
  return jwt.sign({ id: userId, jti }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatar: user.avatar,
    city: user.city,
    skills: user.skills,
    interests: user.interests,
    followers: user.followers,
    following: user.following,
    savedPosts: user.savedPosts,
    hiddenPosts: user.hiddenPosts,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    birthdayVerified: user.birthdayVerified,
    identityVerification: user.identityVerification?.status,
    twoFactorEnabled: user.twoFactor?.enabled || false,
    language: user.language,
    accessibility: user.accessibility,
    connectedAccounts: {
      facebook: !!user.connectedAccounts?.facebook?.connected,
      threads: !!user.connectedAccounts?.threads?.connected,
    },
  };
}

/** Creates a Session doc + signed JWT for a fully-authenticated login (post 2FA if applicable) */
async function createSessionAndToken(user, req) {
  const jti = uuidv4();
  const info = describeRequest(req);
  await Session.create({
    user: user._id,
    tokenId: jti,
    ...info,
  });
  return signToken(user._id, jti);
}

// ============ Register ============
router.post("/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });
    if (existing) {
      return res.status(400).json({ message: "Email or username already in use" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashed,
    });

    // Fire off an email-verification OTP right away (Email Verification feature)
    const code = issueOtp(user, "email_verify", user.email);
    await user.save();
    sendEmail({
      to: user.email,
      subject: "Verify your Vibely email",
      html: otpEmailTemplate({ code, purposeLabel: "email verification" }),
      text: `Your Vibely email verification code is ${code}`,
    }).catch((e) => console.error("Email send failed:", e.message));

    const token = await createSessionAndToken(user, req);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============ Login (step 1: password check, may return a 2FA challenge) ============
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername.toLowerCase() },
      ],
    });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (user.accountStatus === "suspended") {
      return res.status(403).json({ message: "This account has been suspended" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    if (user.accountStatus === "deactivated") {
      user.accountStatus = "active";
      await user.save();
    }

    // 2FA enabled → don't issue a full session token yet, issue a short-lived challenge instead
    if (user.twoFactor?.enabled) {
      const challengeToken = jwt.sign(
        { id: user._id, purpose: "2fa_challenge" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );
      return res.json({ twoFactorRequired: true, challengeToken });
    }

    const token = await createSessionAndToken(user, req);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============ Login (step 2: verify TOTP code or backup code) ============
router.post("/login/verify-2fa", async (req, res) => {
  try {
    const { challengeToken, code, isBackupCode } = req.body;
    if (!challengeToken || !code) {
      return res.status(400).json({ message: "challengeToken and code are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(challengeToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Challenge expired, please log in again" });
    }
    if (decoded.purpose !== "2fa_challenge") {
      return res.status(400).json({ message: "Invalid challenge" });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.twoFactor?.enabled) {
      return res.status(400).json({ message: "2FA is not enabled on this account" });
    }

    let ok = false;
    if (isBackupCode) {
      ok = await verifyAndConsumeCode(user, code);
      if (ok) await user.save();
    } else {
      ok = speakeasy.totp.verify({
        secret: user.twoFactor.secret,
        encoding: "base32",
        token: code,
        window: 1,
      });
    }

    if (!ok) return res.status(400).json({ message: "Incorrect code" });

    const token = await createSessionAndToken(user, req);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============ Logout (current device only) ============
router.post("/logout", auth, async (req, res) => {
  try {
    if (req.tokenId) {
      await Session.updateOne(
        { tokenId: req.tokenId },
        { revoked: true, revokedAt: new Date() }
      );
    }
    res.json({ message: "Logged out" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
