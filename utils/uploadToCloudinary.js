// const cloudinary = require("../config/cloudinary");

// const uploadToCloudinary = (fileBuffer, folder) => {
//   return new Promise((resolve, reject) => {

//     cloudinary.uploader.upload_stream(
//       { folder: folder },
//       (error, result) => {

//         if (error) return reject(error);

//         resolve(result.secure_url);
//       }
//     ).end(fileBuffer);

//   });
// };

// module.exports = uploadToCloudinary;


const cloudinary = require("../config/cloudinary");


const uploadToCloudinary = (fileBuffer, folder = "bmt/palaces") => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      return reject(new Error("Valid file buffer is required"));
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Cloudinary upload failed"));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.end(fileBuffer);
  });
};


const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return null;

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
