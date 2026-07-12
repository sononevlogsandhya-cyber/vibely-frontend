const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");

// Reels need local ffmpeg processing (trim + cover-frame extraction) before the
// final files go up to Cloudinary, so this stays on disk - but in the OS temp
// folder rather than a persistent app folder, since we upload-and-delete each
// file within the same request (see routes/reels.js).
const tmpDir = path.join(os.tmpdir(), "vibely-reel-uploads");
fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

function fileFilter(req, file, cb) {
  const allowed = /mp4|mov|webm|mkv|avi/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = /video\//.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error("Only video files are allowed (mp4, mov, webm)"));
}

const uploadVideo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
});

module.exports = uploadVideo;
