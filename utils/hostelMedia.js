const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MEDIA_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "video/mp4", "video/webm", "video/quicktime",
];
const DOC_TYPES = [...MEDIA_TYPES, "application/pdf"];
const MAX_SIZE = 20 * 1024 * 1024;

// "images" field => photo/video only, "documents" field => photo/video/pdf
exports.checkFiles = (files, max, label) => {
  if (files.length > max) throw new Error(`Maximum ${max} ${label} are allowed.`);
  for (const f of files) {
    const allowed = f.fieldname === "documents" ? DOC_TYPES : MEDIA_TYPES;
    if (!allowed.includes(f.mimetype)) throw new Error(`${f.originalname}: file type not allowed.`);
    if (f.size > MAX_SIZE) throw new Error(`${f.originalname} is larger than 20 MB.`);
  }
};

const uploadOne = (file, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          originalName: file.originalname,
          resourceType: result.resource_type, // image | video | raw
        });
      }
    );
    stream.end(file.buffer);
  });

exports.cleanupUploadedAssets = async (assets = []) => {
  await Promise.allSettled(
    assets.filter((a) => a && a.publicId).map((a) =>
      cloudinary.uploader.destroy(a.publicId, {
        resource_type: a.resourceType || "image",
        invalidate: true,
      })
    )
  );
};

exports.uploadMultipleFiles = async (files = [], folder) => {
  if (!files.length) return [];
  const results = await Promise.allSettled(files.map((f) => uploadOne(f, folder)));
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    await exports.cleanupUploadedAssets(ok); // no half uploads left on Cloudinary
    throw new Error(failed.reason?.message || "File upload failed.");
  }
  return ok;
};