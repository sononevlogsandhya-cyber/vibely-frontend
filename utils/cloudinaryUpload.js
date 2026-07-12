const fs = require("fs");
const cloudinary = require("../config/cloudinary");

/**
 * Uploads a local file (already on disk, e.g. from a temp/ffmpeg step) to Cloudinary
 * and deletes the local copy afterwards. Used by the reels flow, where video/cover
 * files must exist locally for ffmpeg processing before we ship them to the cloud.
 *
 * @param {string} localPath - path to the file on local/temp disk
 * @param {object} options - extra Cloudinary upload options (folder, resource_type, etc.)
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadLocalFileToCloudinary(localPath, options = {}) {
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: "auto",
      folder: "vibely",
      ...options,
    });
    return { url: result.secure_url, publicId: result.public_id };
  } finally {
    fs.unlink(localPath, () => {}); // best-effort cleanup of the temp file either way
  }
}

module.exports = { uploadLocalFileToCloudinary };
