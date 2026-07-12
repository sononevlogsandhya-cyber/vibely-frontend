const mongoose = require("mongoose");

const reelCommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 300 },
  },
  { timestamps: true }
);

const reelSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    video: { type: String, required: true },
    cover: { type: String, default: "" }, // thumbnail image path
    duration: { type: Number, default: 0 }, // seconds, after trim
    caption: { type: String, default: "", maxlength: 2200 },
    hashtags: [{ type: String, maxlength: 50, lowercase: true, index: true }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [reelCommentSchema],
  },
  { timestamps: true }
);

reelSchema.pre("save", function (next) {
  if (this.isModified("caption")) {
    const matches = this.caption.match(/#[\p{L}0-9_]+/gu) || [];
    this.hashtags = [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
  }
  next();
});

module.exports = mongoose.model("Reel", reelSchema);
