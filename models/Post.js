const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 300 },
    parent: { type: mongoose.Schema.Types.ObjectId, default: null }, // reply-to comment id (within same array)
    pinned: { type: Boolean, default: false },
    edited: { type: Boolean, default: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    images: { type: [String], required: true, validate: (v) => v.length > 0 && v.length <= 10 },
    caption: { type: String, default: "", maxlength: 2200 },
    tags: [{ type: String, maxlength: 30 }],
    hashtags: [{ type: String, maxlength: 50, lowercase: true, index: true }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
  },
  { timestamps: true }
);

// auto-extract #hashtags from caption before save
postSchema.pre("save", function (next) {
  if (this.isModified("caption")) {
    const matches = this.caption.match(/#[\p{L}0-9_]+/gu) || [];
    this.hashtags = [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
  }
  next();
});

module.exports = mongoose.model("Post", postSchema);
