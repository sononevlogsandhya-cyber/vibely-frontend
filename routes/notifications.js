const express = require("express");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("sender", "name username avatar")
      .populate("post", "image");
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.userId, read: false }, { read: true });
    res.json({ message: "Marked all as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
