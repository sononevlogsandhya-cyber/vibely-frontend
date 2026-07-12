const express = require("express");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Report = require("../models/Report");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.post("/", auth, upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    const tags = (req.body.tags || "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);

    const post = await Post.create({
      user: req.userId,
      images: req.files.map((f) => f.path),
      caption: req.body.caption || "",
      tags,
    });

    const populated = await post.populate("user", "name username avatar");

    // Broadcast to everyone online — Feed/Explore filter client-side by who they follow
    const io = req.app.get("io");
    io.emit("new-post", populated);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/feed", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const authors = [...me.following, me._id].filter(
      (id) => !me.mutedUsers.some((m) => m.toString() === id.toString())
    );

    const posts = await Post.find({
      user: { $in: authors, $nin: me.blockedUsers },
      _id: { $nin: me.hiddenPosts },
    })
      .sort({ createdAt: -1 })
      .populate("user", "name username avatar")
      .populate("comments.user", "name username avatar");

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/explore", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const posts = await Post.find({ user: { $nin: me.blockedUsers }, _id: { $nin: me.hiddenPosts } })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name username avatar")
      .populate("comments.user", "name username avatar");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/posts/trending  (sorted by engagement — likes + comments — in the last 3 days)
router.get("/trending", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const posts = await Post.find({
      createdAt: { $gte: threeDaysAgo },
      user: { $nin: me.blockedUsers },
      _id: { $nin: me.hiddenPosts },
    })
      .populate("user", "name username avatar")
      .populate("comments.user", "name username avatar");

    const scored = posts
      .map((p) => ({
        post: p,
        score: p.likes.length * 2 + p.comments.length * 3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((s) => s.post);

    res.json(scored);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/posts/interest  (posts tagged with any of my selected interests)
router.get("/interest", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me.interests || me.interests.length === 0) {
      return res.json([]);
    }
    const posts = await Post.find({
      tags: { $in: me.interests },
      user: { $nin: me.blockedUsers },
      _id: { $nin: me.hiddenPosts },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name username avatar")
      .populate("comments.user", "name username avatar");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/user/:userId", auth, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyLiked = post.likes.includes(req.userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== req.userId);
    } else {
      post.likes.push(req.userId);

      if (post.user.toString() !== req.userId) {
        const me = await User.findById(req.userId);
        const notification = await Notification.create({
          recipient: post.user,
          sender: req.userId,
          type: "like",
          post: post._id,
        });

        const io = req.app.get("io");
        const onlineUsers = req.app.get("onlineUsers");
        const targetSocket = onlineUsers.get(post.user.toString());
        if (targetSocket) {
          io.to(targetSocket).emit("notification", {
            type: "like",
            from: { id: me._id, name: me.name, username: me.username, avatar: me.avatar },
            postId: post._id,
            notificationId: notification._id,
          });
        }
      }
    }

    await post.save();

    const io = req.app.get("io");
    io.to(`post-${post._id}`).emit("post-updated", { postId: post._id, likes: post.likes });

    res.json({ likes: post.likes, liked: !alreadyLiked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/comment", auth, async (req, res) => {
  try {
    const { text, parent } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (parent) {
      const parentExists = post.comments.id(parent);
      if (!parentExists) return res.status(404).json({ message: "Parent comment not found" });
    }

    post.comments.push({ user: req.userId, text: text.trim(), parent: parent || null });
    await post.save();

    if (post.user.toString() !== req.userId) {
      const me = await User.findById(req.userId);
      const notification = await Notification.create({
        recipient: post.user,
        sender: req.userId,
        type: "comment",
        post: post._id,
      });

      const io = req.app.get("io");
      const onlineUsers = req.app.get("onlineUsers");
      const targetSocket = onlineUsers.get(post.user.toString());
      if (targetSocket) {
        io.to(targetSocket).emit("notification", {
          type: "comment",
          from: { id: me._id, name: me.name, username: me.username, avatar: me.avatar },
          postId: post._id,
          text: text.trim(),
          notificationId: notification._id,
        });
      }
    }

    const populated = await post.populate("comments.user", "name username avatar");

    const io = req.app.get("io");
    io.to(`post-${post._id}`).emit("post-comment-added", {
      postId: post._id,
      comments: populated.comments,
    });

    res.status(201).json(populated.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/posts/:id/save  (toggle save/bookmark for the logged-in user)
router.put("/:id/save", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const me = await User.findById(req.userId);
    const alreadySaved = me.savedPosts.some((id) => id.toString() === req.params.id);

    if (alreadySaved) {
      me.savedPosts = me.savedPosts.filter((id) => id.toString() !== req.params.id);
    } else {
      me.savedPosts.push(post._id);
    }
    await me.save();

    res.json({ saved: !alreadySaved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/posts/:id/hide  (remove from my own feed — covers both "Hide post" and "Not interested")
router.put("/:id/hide", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const me = await User.findById(req.userId);
    const alreadyHidden = me.hiddenPosts.some((id) => id.toString() === req.params.id);

    if (alreadyHidden) {
      me.hiddenPosts = me.hiddenPosts.filter((id) => id.toString() !== req.params.id);
    } else {
      me.hiddenPosts.push(post._id);
    }
    await me.save();

    res.json({ hidden: !alreadyHidden });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  POST /api/posts/:id/report
router.post("/:id/report", auth, async (req, res) => {
  try {
    const { reason, details } = req.body;
    const validReasons = [
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
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ message: "Please choose a valid report reason" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    await Report.create({
      reporter: req.userId,
      targetType: "post",
      targetId: post._id,
      targetOwner: post.user,
      reason,
      details: (details || "").slice(0, 500),
    });

    // Reporting also hides it from the reporter's own feed right away
    const me = await User.findById(req.userId);
    if (!me.hiddenPosts.some((id) => id.toString() === req.params.id)) {
      me.hiddenPosts.push(post._id);
      await me.save();
    }

    res.status(201).json({ message: "Thanks for letting us know. Our team will review this post." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get("/me/saved", auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const posts = await Post.find({ _id: { $in: me.savedPosts } })
      .populate("user", "name username avatar")
      .populate("comments.user", "name username avatar");

    // Preserve save order (most recently saved first)
    const order = me.savedPosts.map((id) => id.toString());
    posts.sort((a, b) => order.indexOf(b._id.toString()) - order.indexOf(a._id.toString()));

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/posts/:id/comment/:commentId  (edit own comment)
router.put("/:id/comment/:commentId", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: "Comment text is required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.user.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to edit this comment" });
    }

    comment.text = text.trim();
    comment.edited = true;
    await post.save();

    const populated = await post.populate("comments.user", "name username avatar");
    const io = req.app.get("io");
    io.to(`post-${post._id}`).emit("post-comment-updated", { postId: post._id, comments: populated.comments });

    res.json(populated.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  DELETE /api/posts/:id/comment/:commentId  (comment author OR post owner can delete)
router.delete("/:id/comment/:commentId", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const isCommentAuthor = comment.user.toString() === req.userId;
    const isPostOwner = post.user.toString() === req.userId;
    if (!isCommentAuthor && !isPostOwner) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    // also remove any replies pointing to this comment
    post.comments = post.comments.filter(
      (c) => c._id.toString() !== req.params.commentId && (!c.parent || c.parent.toString() !== req.params.commentId)
    );
    await post.save();

    const populated = await post.populate("comments.user", "name username avatar");
    const io = req.app.get("io");
    io.to(`post-${post._id}`).emit("post-comment-updated", { postId: post._id, comments: populated.comments });

    res.json(populated.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/posts/:id/comment/:commentId/pin  (post owner only, one pinned comment at a time)
router.put("/:id/comment/:commentId/pin", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the post owner can pin comments" });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const willPin = !comment.pinned;
    post.comments.forEach((c) => (c.pinned = false)); // only one pinned comment
    comment.pinned = willPin;
    await post.save();

    const populated = await post.populate("comments.user", "name username avatar");
    const io = req.app.get("io");
    io.to(`post-${post._id}`).emit("post-comment-updated", { postId: post._id, comments: populated.comments });
    res.json(populated.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/posts/:id/comment/:commentId/like  (toggle like on a comment)
router.put("/:id/comment/:commentId/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const already = comment.likes.some((id) => id.toString() === req.userId);
    if (already) {
      comment.likes = comment.likes.filter((id) => id.toString() !== req.userId);
    } else {
      comment.likes.push(req.userId);
    }
    await post.save();

    const populated = await post.populate("comments.user", "name username avatar");
    const io = req.app.get("io");
    io.to(`post-${post._id}`).emit("post-comment-updated", {
      postId: post._id,
      comments: populated.comments,
    });

    res.json({ commentId: comment._id, likes: comment.likes, liked: !already });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/posts/:id  (edit caption of own post — hashtags auto re-extracted)
router.put("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to edit this post" });
    }
    if (typeof req.body.caption === "string") {
      post.caption = req.body.caption;
    }
    await post.save();
    const populated = await post.populate("user", "name username avatar");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/posts/hashtag/:tag  (all posts using a given hashtag)
router.get("/hashtag/:tag", auth, async (req, res) => {
  try {
    const tag = req.params.tag.toLowerCase().replace(/^#/, "");
    const posts = await Post.find({ hashtags: tag })
      .sort({ createdAt: -1 })
      .populate("user", "name username avatar")
      .populate("comments.user", "name username avatar");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }
    await post.deleteOne();
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
