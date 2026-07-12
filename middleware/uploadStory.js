const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Stories can be an image (composited with text/stickers on the client)
// or a short video - "auto" lets Cloudinary detect and store either correctly.
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "vibely/stories",
    resource_type: "auto",
  },
});

function fileFilter(req, file, cb) {
  const okImage = /image\//.test(file.mimetype);
  const okVideo = /video\//.test(file.mimetype);
  if (okImage || okVideo) return cb(null, true);
  cb(new Error("Only image or video files are allowed"));
}

const uploadStory = multer({
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

module.exports = uploadStory;
