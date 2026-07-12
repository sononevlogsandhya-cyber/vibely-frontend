const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    bio: { type: String, default: "", maxlength: 150 },
    avatar: { type: String, default: "" },
    city: { type: String, default: "" },
    skills: [{ type: String, maxlength: 30 }],
    interests: [{ type: String, maxlength: 30 }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    // Posts the user chose to hide from their own feed ("Hide" or "Not interested")
    hiddenPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],

    // saved collections (organize saved posts into named folders)
    savedCollections: [
      {
        name: { type: String, required: true, maxlength: 50 },
        posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // privacy & safety
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // muted posts
    mutedStoryUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    restrictedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    hiddenWords: [{ type: String, maxlength: 50 }],
    isPrivate: { type: Boolean, default: false },

    // ============ Account Center: Verification ============
    phone: { type: String, default: "" },
    // Optional Gmail address the user can supply to receive the phone-verification
    // OTP at (used instead of their account email), since no SMS provider is wired up yet.
    phoneVerifyGmail: { type: String, default: "" },
    birthday: { type: Date, default: null },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    birthdayVerified: { type: Boolean, default: false },
    identityVerification: {
      status: {
        type: String,
        enum: ["not_started", "pending", "verified", "rejected"],
        default: "not_started",
      },
      documentType: { type: String, default: "" }, // aadhaar / pan / passport / driving_license
      documentNumberMasked: { type: String, default: "" }, // never store full number
      submittedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      note: { type: String, default: "" },
    },

    // OTP storage (short-lived, hashed not required since single-use + expiry + rate-limited)
    otp: {
      code: { type: String, default: null },
      purpose: {
        type: String,
        enum: ["email_verify", "phone_verify", "password_reset", "account_recovery", null],
        default: null,
      },
      target: { type: String, default: "" }, // email or phone the OTP was sent to
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },

    // ============ Account Center: Security ============
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: "" }, // base32 TOTP secret
      pendingSecret: { type: String, default: "" }, // set during setup, before confirm
      backupCodes: [
        {
          codeHash: { type: String },
          used: { type: Boolean, default: false },
        },
      ],
    },

    passkeys: [
      {
        credentialId: { type: String },
        publicKey: { type: String },
        deviceLabel: { type: String, default: "" },
        counter: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // ============ Connected external accounts (Meta Account Center style) ============
    connectedAccounts: {
      facebook: {
        connected: { type: Boolean, default: false },
        facebookId: { type: String, default: "" },
        name: { type: String, default: "" },
        connectedAt: { type: Date, default: null },
      },
      threads: {
        connected: { type: Boolean, default: false },
        threadsId: { type: String, default: "" },
        name: { type: String, default: "" },
        connectedAt: { type: Date, default: null },
      },
    },

    // ============ Preferences ============
    language: { type: String, default: "en" }, // en, hi, mr, etc.
    accessibility: {
      fontSize: { type: String, enum: ["small", "default", "large", "xlarge"], default: "default" },
      highContrast: { type: Boolean, default: false },
      reduceMotion: { type: Boolean, default: false },
      screenReaderOptimized: { type: Boolean, default: false },
    },

    accountStatus: {
      type: String,
      enum: ["active", "deactivated", "suspended"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
