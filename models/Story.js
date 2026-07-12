const mongoose = require("mongoose");

const stickerSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["location", "mention", "poll", "question", "hashtag", "link"], required: true },
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 },
    // location: { label }, mention: { username }, hashtag: { tag }, link: { url, label }
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    // poll: { question, options: [String] }, votes: [{ user, optionIndex }]
    question: { type: String },
    options: [{ type: String }],
    votes: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        optionIndex: { type: Number },
      },
    ],
  },
  { _id: true }
);

const storySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    media: { type: String, required: true }, // /uploads/xyz.png (final composited image or video)
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    stickers: [stickerSchema], // interactive stickers (poll votes tracked server-side)
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now, expires: 86400 }, // auto-delete after 24h
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);

module.exports = mongoose.model("Story", storySchema);
