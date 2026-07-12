const express = require("express");
const path = require("path");
const os = require("os");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const Reel = require("../models/Reel");
const User = require("../models/User");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const uploadVideo = require("../middleware/uploadVideo");
const { uploadLocalFileToCloudinary } = require("../utils/cloudinaryUpload");

ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

const UPLOAD_DIR = path.join(os.tmpdir(), "vibely-reel-uploads");

function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration || 0);
    });
  });
}

function trimVideo(inputPath, outputPath, start, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(start)
      .setDuration(duration)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

function extractCoverFrame(inputPath, outputPath, atSeconds) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [atSeconds || 0.1],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: "480x?",
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

// @route  POST /api/reels  (upload a new reel — optional trimStart/trimEnd + coverTime in seconds)
router.post("/", auth, uploadVideo.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Video is required" });

    let videoFilename = req.file.filename;
    let videoPath = path.join(UPLOAD_DIR, videoFilename);
    const trimStart = parseFloat(req.body.trimStart);
    const trimEnd = parseFloat(req.body.trimEnd);
    const coverTime = parseFloat(req.body.coverTime) || 0.1;

    // Server-side trim if valid start/end were supplied
    if (!isNaN(trimStart) && !isNaN(trimEnd) && trimEnd > trimStart) {
      const trimmedFilename = `trimmed-${Date.now()}-${videoFilename}`;
      const trimmedPath = path.join(UPLOAD_DIR, trimmedFilename);
      try {
        await trimVideo(videoPath, trimmedPath, trimStart, trimEnd - trimStart);
        fs.unlink(videoPath, () => {});
        videoFilename = trimmedFilename;
        videoPath = trimmedPath;
      } catch (trimErr) {
        console.error("Trim failed, using original video:", trimErr.message);
      }
    }

    let duration = 0;
    try {
      duration = await getVideoDuration(videoPath);
    } catch (e) {
      /* ignore, keep 0 */
    }

    // Auto-generate a cover thumbnail from the chosen frame
    let localCoverPath = "";
    try {
      const coverFilename = `cover-${Date.now()}.jpg`;
      localCoverPath = path.join(UPLOAD_DIR, coverFilename);
      await extractCoverFrame(videoPath, localCoverPath, Math.min(coverTime, Math.max(duration - 0.1, 0.1)));
    } catch (e) {
      console.error("Cover extraction failed:", e.message);
      localCoverPath = "";
    }

    // Ship the final (possibly trimmed) video + generated cover to Cloudinary,
    // then delete the local temp copies — Render/Railway disks don't persist.
    let videoUrl = "";
    let coverUrl = "";
    try {
      const videoUpload = await uploadLocalFileToCloudinary(videoPath, {
        folder: "vibely/reels",
        resource_type: "video",
      });
      videoUrl = videoUpload.url;
    } catch (e) {
      return res.status(500).json({ message: "Video upload failed: " + e.message });
    }
    if (localCoverPath) {
      try {
        const coverUpload = await uploadLocalFileToCloudinary(localCoverPath, {
          folder: "vibely/reels",
          resource_type: "image",
        });
        coverUrl = coverUpload.url;
      } catch (e) {
        console.error("Cover upload failed:", e.message);
      }
    }

    const reel = await Reel.create({
      user: req.userId,
      video: videoUrl,
      cover: coverUrl,
      duration,
      caption: req.body.caption || "",
    });

    const populated = await reel.populate("user", "name username avatar");

    const io = req.app.get("io");
    io.emit("new-reel", populated);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/reels/feed  (all reels, newest first - vertical scroll feed)
router.get("/feed", auth, async (req, res) => {
  try {
    const reels = await Reel.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name username avatar")
      .populate("comments.user", "name username avatar");
    res.json(reels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  PUT /api/reels/:id/like
router.put("/:id/like", auth, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    const alreadyLiked = reel.likes.includes(req.userId);

    if (alreadyLiked) {
      reel.likes = reel.likes.filter((id) => id.toString() !== req.userId);
    } else {
      reel.likes.push(req.userId);

      if (reel.user.toString() !== req.userId) {
        const me = await User.findById(req.userId);
        const notification = await Notification.create({
          recipient: reel.user,
          sender: req.userId,
          type: "like",
        });

        const io = req.app.get("io");
        const onlineUsers = req.app.get("onlineUsers");
        const targetSocket = onlineUsers.get(reel.user.toString());
        if (targetSocket) {
          io.to(targetSocket).emit("notification", {
            type: "like",
            from: { id: me._id, name: me.name, username: me.username, avatar: me.avatar },
            notificationId: notification._id,
          });
        }
      }
    }

    await reel.save();

    const io2 = req.app.get("io");
    io2.to(`reel-${reel._id}`).emit("reel-updated", { reelId: reel._id, likes: reel.likes });

    res.json({ likes: reel.likes, liked: !alreadyLiked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  POST /api/reels/:id/comment
router.post("/:id/comment", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    reel.comments.push({ user: req.userId, text: text.trim() });
    await reel.save();

    const populated = await reel.populate("comments.user", "name username avatar");

    const io = req.app.get("io");
    io.to(`reel-${reel._id}`).emit("reel-comment-added", {
      reelId: reel._id,
      comments: populated.comments,
    });

    res.status(201).json(populated.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  DELETE /api/reels/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });
    if (reel.user.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to delete this reel" });
    }
    await reel.deleteOne();
    res.json({ message: "Reel deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
