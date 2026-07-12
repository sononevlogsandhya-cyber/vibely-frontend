const express = require("express");
const Story = require("../models/Story");
const User = require("../models/User");
const auth = require("../middleware/auth");
const uploadStory = require("../middleware/uploadStory");

const router = express.Router();

// @route  POST /api/stories  (create a new story - image is pre-composited on the client with text/emoji;
// non-baked interactive stickers like polls/mentions/location are sent separately as JSON in `stickers`)
router.post("/", auth, uploadStory.single("media"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Story media is required" });

    const mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";

    let stickers = [];
    if (req.body.stickers) {
      try {
        stickers = JSON.parse(req.body.stickers);
      } catch (e) {
        stickers = [];
      }
    }

    const story = await Story.create({
      user: req.userId,
      media: req.file.path,
      mediaType,
      stickers,
    });

    const populated = await story.populate("user", "name username avatar");

    const io = req.app.get("io");
    io.emit("new-story", populated);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/stories/:id/sticker/:stickerId/vote  (vote on a poll sticker)
router.put("/:id/sticker/:stickerId/vote", auth, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: "Story not found" });

    const sticker = story.stickers.id(req.params.stickerId);
    if (!sticker || sticker.type !== "poll") return res.status(404).json({ message: "Poll sticker not found" });

    sticker.votes = sticker.votes.filter((v) => v.user.toString() !== req.userId);
    sticker.votes.push({ user: req.userId, optionIndex });
    await story.save();

    const tally = sticker.options.map((_, i) => sticker.votes.filter((v) => v.optionIndex === i).length);
    res.json({ stickerId: sticker._id, tally, myVote: optionIndex });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/stories/feed
// Returns stories grouped by user, only from people you follow + yourself, only active (<24h, handled by TTL index)
router.get("/feed", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const authors = [...me.following, me._id];

    const stories = await Story.find({ user: { $in: authors } })
      .sort({ createdAt: 1 })
      .populate("user", "name username avatar");

    const grouped = {};
    for (const story of stories) {
      const uid = story.user._id.toString();
      if (!grouped[uid]) {
        grouped[uid] = { user: story.user, stories: [] };
      }
      grouped[uid].stories.push(story);
    }

    // Put my own stories first if I have any
    const result = Object.values(grouped).sort((a, b) => {
      if (a.user._id.toString() === req.userId) return -1;
      if (b.user._id.toString() === req.userId) return 1;
      return 0;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/stories/:id/view  (mark a story as viewed by me)
router.put("/:id/view", auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: "Story not found" });

    if (!story.viewers.includes(req.userId)) {
      story.viewers.push(req.userId);
      await story.save();
    }
    res.json({ message: "Viewed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/stories/:id/viewers  (see who viewed my story)
router.get("/:id/viewers", auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id).populate(
      "viewers",
      "name username avatar"
    );
    if (!story) return res.status(404).json({ message: "Story not found" });
    if (story.user.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    res.json(story.viewers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  DELETE /api/stories/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: "Story not found" });
    if (story.user.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await story.deleteOne();
    res.json({ message: "Story deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
