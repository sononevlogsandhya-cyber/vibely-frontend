const express = require("express");
const User = require("../models/User");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// @route  GET /api/users/me/analytics  (my post/engagement stats + auto-computed achievement badges)
router.get("/me/analytics", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const posts = await Post.find({ user: req.userId });

    const totalLikes = posts.reduce((sum, p) => sum + p.likes.length, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.comments.length, 0);

    // Posts per day for the last 7 days (for a simple bar chart on the frontend)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      const count = posts.filter(
        (p) => p.createdAt >= day && p.createdAt < nextDay
      ).length;
      days.push({ date: day.toISOString().slice(0, 10), count });
    }

    const badges = [];
    if (posts.length >= 1) badges.push({ id: "first-post", label: "First Post", icon: "🌱" });
    if (posts.length >= 10) badges.push({ id: "creator", label: "Creator", icon: "🎨" });
    if (posts.length >= 50) badges.push({ id: "power-creator", label: "Power Creator", icon: "🚀" });
    if (me.followers.length >= 10) badges.push({ id: "rising", label: "Rising Star", icon: "⭐" });
    if (me.followers.length >= 100) badges.push({ id: "influencer", label: "Influencer", icon: "🏆" });
    if (totalLikes >= 50) badges.push({ id: "loved", label: "Crowd Favorite", icon: "❤️" });
    if (totalLikes >= 500) badges.push({ id: "viral", label: "Viral", icon: "🔥" });

    res.json({
      postCount: posts.length,
      totalLikes,
      totalComments,
      followerCount: me.followers.length,
      followingCount: me.following.length,
      last7Days: days,
      badges,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/search", auth, async (req, res) => {
  try {
    const q = req.query.q || "";
    const me = await User.findById(req.userId);
    const users = await User.find({
      _id: { $nin: me.blockedUsers },
      $or: [
        { username: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ],
    })
      .select("name username avatar")
      .limit(15);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:username", auth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() })
      .select("-password")
      .populate("followers", "name username avatar")
      .populate("following", "name username avatar");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/me/update", auth, upload.single("avatar"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (req.body.name) user.name = req.body.name;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.city !== undefined) user.city = req.body.city;
    if (req.body.skills !== undefined) {
      user.skills = req.body.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
    }
    if (req.body.interests !== undefined) {
      user.interests = req.body.interests
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10);
    }
    if (req.file) user.avatar = req.file.path;

    await user.save();
    const safeUser = user.toObject();
    delete safeUser.password;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id/follow", auth, async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ message: "You can't follow yourself" });
    }

    const target = await User.findById(req.params.id);
    const me = await User.findById(req.userId);
    if (!target || !me) return res.status(404).json({ message: "User not found" });

    if (me.blockedUsers.some((id) => id.toString() === req.params.id)) {
      return res.status(403).json({ message: "Unblock this user first" });
    }
    if (target.blockedUsers.some((id) => id.toString() === req.userId)) {
      return res.status(403).json({ message: "You can't follow this user" });
    }

    const alreadyFollowing = target.followers.includes(req.userId);

    if (alreadyFollowing) {
      target.followers = target.followers.filter((id) => id.toString() !== req.userId);
      me.following = me.following.filter((id) => id.toString() !== req.params.id);
      await target.save();
      await me.save();
      return res.json({ message: "Unfollowed", following: false });
    } else {
      target.followers.push(req.userId);
      me.following.push(req.params.id);
      await target.save();
      await me.save();

      const notification = await Notification.create({
        recipient: target._id,
        sender: req.userId,
        type: "follow",
      });

      const io = req.app.get("io");
      const onlineUsers = req.app.get("onlineUsers");
      const targetSocket = onlineUsers.get(target._id.toString());
      if (targetSocket) {
        io.to(targetSocket).emit("notification", {
          type: "follow",
          from: { id: me._id, name: me.name, username: me.username, avatar: me.avatar },
          notificationId: notification._id,
        });
      }

      return res.json({ message: "Followed", following: true });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============ PRIVACY & SAFETY ============

// @route  PUT /api/users/:id/block  (toggle block — also removes any follow relationship both ways)
router.put("/:id/block", auth, async (req, res) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ message: "You can't block yourself" });
    const me = await User.findById(req.userId);
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });

    const already = me.blockedUsers.some((id) => id.toString() === req.params.id);
    if (already) {
      me.blockedUsers = me.blockedUsers.filter((id) => id.toString() !== req.params.id);
    } else {
      me.blockedUsers.push(req.params.id);
      // sever follow relationship both directions
      me.following = me.following.filter((id) => id.toString() !== req.params.id);
      me.followers = me.followers.filter((id) => id.toString() !== req.params.id);
      target.following = target.following.filter((id) => id.toString() !== req.userId);
      target.followers = target.followers.filter((id) => id.toString() !== req.userId);
      await target.save();
    }
    await me.save();
    res.json({ blocked: !already });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/users/me/blocked  (list of blocked users)
router.get("/me/blocked", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId).populate("blockedUsers", "name username avatar");
    res.json(me.blockedUsers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/users/:id/mute  (mute someone's posts from your feed without unfollowing)
router.put("/:id/mute", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const already = me.mutedUsers.some((id) => id.toString() === req.params.id);
    if (already) {
      me.mutedUsers = me.mutedUsers.filter((id) => id.toString() !== req.params.id);
    } else {
      me.mutedUsers.push(req.params.id);
    }
    await me.save();
    res.json({ muted: !already });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/users/:id/mute-story  (mute someone's stories only)
router.put("/:id/mute-story", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const already = me.mutedStoryUsers.some((id) => id.toString() === req.params.id);
    if (already) {
      me.mutedStoryUsers = me.mutedStoryUsers.filter((id) => id.toString() !== req.params.id);
    } else {
      me.mutedStoryUsers.push(req.params.id);
    }
    await me.save();
    res.json({ mutedStory: !already });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/users/:id/restrict  (restrict — their comments become visible only to them, no notification of restriction)
router.put("/:id/restrict", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const already = me.restrictedUsers.some((id) => id.toString() === req.params.id);
    if (already) {
      me.restrictedUsers = me.restrictedUsers.filter((id) => id.toString() !== req.params.id);
    } else {
      me.restrictedUsers.push(req.params.id);
    }
    await me.save();
    res.json({ restricted: !already });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/users/me/hidden-words  (replace the full hidden-words list used to auto-filter comments)
router.put("/me/hidden-words", auth, async (req, res) => {
  try {
    const words = Array.isArray(req.body.words) ? req.body.words.map((w) => String(w).trim()).filter(Boolean) : [];
    const me = await User.findByIdAndUpdate(req.userId, { hiddenWords: words }, { new: true });
    res.json({ hiddenWords: me.hiddenWords });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============ SAVED COLLECTIONS ============

// @route  POST /api/users/me/collections  (create a new named collection)
router.post("/me/collections", auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Collection name is required" });
    const me = await User.findById(req.userId);
    me.savedCollections.push({ name: name.trim(), posts: [] });
    await me.save();
    res.status(201).json(me.savedCollections);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/users/me/collections  (list all collections, post counts only)
router.get("/me/collections", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const summary = me.savedCollections.map((c) => ({
      _id: c._id,
      name: c.name,
      count: c.posts.length,
      coverPost: c.posts[c.posts.length - 1] || null,
    }));
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/users/me/collections/:collectionId  (posts inside one collection)
router.get("/me/collections/:collectionId", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const collection = me.savedCollections.id(req.params.collectionId);
    if (!collection) return res.status(404).json({ message: "Collection not found" });
    const posts = await Post.find({ _id: { $in: collection.posts } }).populate("user", "name username avatar");
    res.json({ name: collection.name, posts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/users/me/collections/:collectionId/toggle/:postId  (add/remove a post from a collection)
router.put("/me/collections/:collectionId/toggle/:postId", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const collection = me.savedCollections.id(req.params.collectionId);
    if (!collection) return res.status(404).json({ message: "Collection not found" });

    const has = collection.posts.some((id) => id.toString() === req.params.postId);
    if (has) {
      collection.posts = collection.posts.filter((id) => id.toString() !== req.params.postId);
    } else {
      collection.posts.push(req.params.postId);
      if (!me.savedPosts.some((id) => id.toString() === req.params.postId)) {
        me.savedPosts.push(req.params.postId);
      }
    }
    await me.save();
    res.json({ added: !has });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  DELETE /api/users/me/collections/:collectionId
router.delete("/me/collections/:collectionId", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    me.savedCollections = me.savedCollections.filter((c) => c._id.toString() !== req.params.collectionId);
    await me.save();
    res.json({ message: "Collection deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
