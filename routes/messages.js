const express = require("express");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const auth = require("../middleware/auth");

const router = express.Router();

// @route  GET /api/messages/unread-count  (how many conversations have unread messages for me)
router.get("/unread-count", auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId });

    // Count messages sent by others, in my conversations, that I haven't read yet
    const count = await Message.countDocuments({
      conversation: { $in: conversations.map((c) => c._id) },
      sender: { $ne: req.userId },
      readBy: { $ne: req.userId },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/messages/conversations  (list my conversations, newest first)
router.get("/conversations", auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name username avatar");
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  POST /api/messages/conversations  (start or fetch existing conversation with a user)
router.post("/conversations", auth, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });
    if (userId === req.userId) {
      return res.status(400).json({ message: "Can't start a conversation with yourself" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.userId, userId], $size: 2 },
    }).populate("participants", "name username avatar");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.userId, userId],
      });
      conversation = await conversation.populate("participants", "name username avatar");
    }

    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/messages/:conversationId  (get messages in a conversation)
router.get("/:conversationId", auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => p.toString() === req.userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const messages = await Message.find({ conversation: req.params.conversationId })
      .sort({ createdAt: 1 })
      .populate("sender", "name username avatar");

    await Message.updateMany(
      { conversation: req.params.conversationId, sender: { $ne: req.userId }, readBy: { $ne: req.userId } },
      { $addToSet: { readBy: req.userId } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  POST /api/messages/:conversationId  (send a message)
router.post("/:conversationId", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => p.toString() === req.userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.userId,
      text: text.trim(),
      readBy: [req.userId],
    });

    conversation.lastMessage = text.trim();
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await message.populate("sender", "name username avatar");

    // Push the message in real-time to the other participant if they're online
    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");
    const otherUserId = conversation.participants.find((p) => p.toString() !== req.userId);
    const targetSocket = onlineUsers.get(otherUserId?.toString());
    if (targetSocket) {
      io.to(targetSocket).emit("new-message", {
        conversationId: conversation._id,
        message: populated,
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
