const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: {
      type: String,
      enum: ["post", "comment", "story", "reel", "message", "user"],
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Who/what the reported content belongs to, so admins can review without extra lookups
    targetOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: {
      type: String,
      enum: [
        "spam",
        "nudity_or_sexual_activity",
        "hate_speech_or_symbols",
        "violence_or_dangerous_orgs",
        "bullying_or_harassment",
        "false_information",
        "scam_or_fraud",
        "intellectual_property",
        "self_injury",
        "other",
      ],
      required: true,
    },
    details: { type: String, maxlength: 500, default: "" },
    status: { type: String, enum: ["pending", "reviewed", "actioned", "dismissed"], default: "pending" },
  },
  { timestamps: true }
);

reportSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("Report", reportSchema);
