const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "vibely/images",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    // Cloudinary generates delivery-optimized derivatives automatically for these
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});

function fileFilter(req, file, cb) {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const mime = allowed.test(file.mimetype);
  if (mime) return cb(null, true);
  cb(new Error("Only image files are allowed (jpg, png, gif, webp)"));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

module.exports = upload;
