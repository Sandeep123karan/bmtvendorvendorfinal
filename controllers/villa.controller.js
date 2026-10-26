
const mongoose = require("mongoose");
const Villa = require("../models/Villa.model");
const cloudinary = require("../config/cloudinary");

// =====================================================
// HELPERS
// =====================================================

const getVendorId = (req) =>
  req.vendor?._id ||
  req.vendor?.id ||
  req.user?._id ||
  req.user?.id ||
  req.vendorId ||
  null;

const validId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const parseArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
};

const parseObject = (value, fallback = {}) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
  }

  return fallback;
};

const parseNumber = (value, field, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${field} must be a valid number.`);
  }

  return number;
};

// =====================================================
// CLOUDINARY IMAGE UPLOAD
// Works with multer.memoryStorage()
// =====================================================

const uploadImage = (file) =>
  new Promise((resolve, reject) => {
    if (!file?.buffer) {
      return reject(new Error("Image buffer is missing."));
    }

    if (!file.mimetype?.startsWith("image/")) {
      return reject(new Error("Only image files are allowed for villas."));
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "bmt/villas",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);

        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Cloudinary image upload failed."));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.end(file.buffer);
  });

// const getUploadedFiles = (req) => {
//   if (Array.isArray(req.files)) return req.files;

//   if (req.files && typeof req.files === "object") {
//     return Object.values(req.files).flat();
//   }

//   return req.file ? [req.file] : [];
// };
const getUploadedFiles = (req) => {
  if (Array.isArray(req.files)) {
    return req.files.filter(
      (file) => file.fieldname === "images"
    );
  }

  return req.files?.images || [];
};
const uploadVillaImages = async (files) => {
  const uploaded = [];

  try {
    for (const file of files) {
      uploaded.push(await uploadImage(file));
    }

    return uploaded;
  } catch (error) {
    await Promise.allSettled(
      uploaded.map((image) =>
        cloudinary.uploader.destroy(image.publicId)
      )
    );

    throw error;
  }
};

const deleteCloudinaryImages = async (images = []) => {
  const publicIds = [
    ...new Set(
      images
        .map((image) => image?.publicId)
        .filter(Boolean)
    ),
  ];

  await Promise.allSettled(
    publicIds.map((publicId) =>
      cloudinary.uploader.destroy(publicId)
    )
  );
};

const sendError = (res, error, label) => {
  console.error(`❌ ${label}:`, error);

  const clientError =
    error.name === "ValidationError" ||
    error.name === "CastError" ||
    error.message?.includes("must be a valid number") ||
    error.message?.includes("Image buffer") ||
    error.message?.includes("Only image files");

  return res.status(clientError ? 400 : 500).json({
    success: false,
    message: clientError
      ? error.message
      : "Villa operation failed.",
    ...(process.env.NODE_ENV !== "production"
      ? { error: error.message }
      : {}),
  });
};

// =====================================================
// CREATE VILLA
// POST /api/vendor/villas
// =====================================================

exports.createVilla = async (req, res) => {
  let uploaded = [];

  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const {
      name,
      shortDescription,
      description,
      contact,
      address,
      bedrooms,
      bathrooms,
      maxGuests,
      pricePerNight,
      amenities,
      coverImage,
      checkInTime,
      checkOutTime,
      policies,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Villa name is required.",
      });
    }

    if (
      pricePerNight === undefined ||
      pricePerNight === "" ||
      !Number.isFinite(Number(pricePerNight)) ||
      Number(pricePerNight) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid pricePerNight is required.",
      });
    }

    const files = getUploadedFiles(req);

    if (files.length > 30) {
      return res.status(400).json({
        success: false,
        message: "Maximum 30 villa images are allowed.",
      });
    }

    // Upload selected files to Cloudinary
    uploaded = await uploadVillaImages(files);

    const imageUrls = uploaded.map((image) => image.url);

    // Cover image can be uploaded separately using coverImage field.
    const coverFile = req.files?.coverImage?.[0];

    let uploadedCover = null;

    if (coverFile) {
      uploadedCover = await uploadImage(coverFile);
      uploaded.push(uploadedCover);
    }

    const villa = await Villa.create({
      vendor: vendorId,
      name: String(name).trim(),
      propertyType: "villa",
      shortDescription: shortDescription || "",
      description: description || "",
      contact: parseObject(contact),
      address: parseObject(address),
      bedrooms: parseNumber(bedrooms, "bedrooms", 1),
      bathrooms: parseNumber(bathrooms, "bathrooms", 1),
      maxGuests: parseNumber(maxGuests, "maxGuests", 2),
      pricePerNight: Number(pricePerNight),
      amenities: parseArray(amenities),
      images: imageUrls,
      coverImage:
        uploadedCover?.url ||
        coverImage ||
        imageUrls[0] ||
        "",
      checkInTime: checkInTime || "14:00",
      checkOutTime: checkOutTime || "11:00",
      policies: parseObject(policies),
      status: "APPROVED",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Villa created successfully.",
      villa,
    });
} catch (error) {
  console.error("❌ CREATE VILLA ERROR:", error);

  await deleteCloudinaryImages(uploaded);

  return res.status(500).json({
    success: false,
    message: error.message || "Villa creation failed",
    errorName: error.name || "Error",
  });
}
};

// =====================================================
// GET MY VILLAS
// GET /api/vendor/villas/my-villas
// =====================================================

exports.getMyVillas = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const filter = { vendor: vendorId };

    if (req.query.status) {
      const status = String(req.query.status).toUpperCase();

      if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid villa status.",
        });
      }

      filter.status = status;
    }

    if (req.query.isActive !== undefined) {
      if (!["true", "false"].includes(String(req.query.isActive))) {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false.",
        });
      }

      filter.isActive = String(req.query.isActive) === "true";
    }

    if (req.query.search?.trim()) {
      filter.name = {
        $regex: String(req.query.search).trim().replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        ),
        $options: "i",
      };
    }

    const villas = await Villa.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      total: villas.length,
      villas,
    });
  } catch (error) {
    return sendError(res, error, "Get My Villas");
  }
};

// =====================================================
// GET SINGLE VILLA
// GET /api/vendor/villas/:id
// =====================================================

exports.getSingleVilla = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid villa ID.",
      });
    }

    const villa = await Villa.findOne({
      _id: req.params.id,
      vendor: vendorId,
    });

    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found.",
      });
    }

    return res.status(200).json({
      success: true,
      villa,
    });
  } catch (error) {
    return sendError(res, error, "Get Single Villa");
  }
};

// =====================================================
// UPDATE VILLA
// PUT /api/vendor/villas/:id
// =====================================================

exports.updateVilla = async (req, res) => {
  let newlyUploaded = [];

  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid villa ID.",
      });
    }

    const villa = await Villa.findOne({
      _id: req.params.id,
      vendor: vendorId,
    });

    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found.",
      });
    }

    const body = req.body;

    if (body.name !== undefined) {
      if (!String(body.name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Villa name cannot be empty.",
        });
      }

      villa.name = String(body.name).trim();
    }

    if (body.shortDescription !== undefined) {
      villa.shortDescription = body.shortDescription;
    }

    if (body.description !== undefined) {
      villa.description = body.description;
    }

    if (body.contact !== undefined) {
      villa.contact = parseObject(body.contact, villa.contact);
    }

    if (body.address !== undefined) {
      villa.address = parseObject(body.address, villa.address);
    }

    for (const field of ["bedrooms", "bathrooms", "maxGuests"]) {
      if (body[field] !== undefined) {
        const min = field === "maxGuests" ? 1 : 0;
        const value = parseNumber(body[field], field, min);

        if (value < min) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field}.`,
          });
        }

        villa[field] = value;
      }
    }

    if (body.pricePerNight !== undefined) {
      const price = parseNumber(
        body.pricePerNight,
        "pricePerNight"
      );

      if (price < 0) {
        return res.status(400).json({
          success: false,
          message: "Price cannot be negative.",
        });
      }

      villa.pricePerNight = price;
    }

    if (body.amenities !== undefined) {
      villa.amenities = parseArray(body.amenities);
    }

    if (body.contact !== undefined) {
      villa.contact = parseObject(body.contact, villa.contact);
    }

    if (body.policies !== undefined) {
      villa.policies = parseObject(body.policies, villa.policies);
    }

    if (body.checkInTime !== undefined) {
      villa.checkInTime = body.checkInTime;
    }

    if (body.checkOutTime !== undefined) {
      villa.checkOutTime = body.checkOutTime;
    }

    // Existing URLs can be sent as JSON array in "existingImages".
    // New files are uploaded and appended to the retained URLs.
    if (body.existingImages !== undefined) {
      villa.images = parseArray(body.existingImages);
    }

    const files = getUploadedFiles(req);

    if (files.length > 30) {
      return res.status(400).json({
        success: false,
        message: "Maximum 30 new villa images are allowed per request.",
      });
    }

    newlyUploaded = await uploadVillaImages(files);

    if (newlyUploaded.length) {
      villa.images = [
        ...(villa.images || []),
        ...newlyUploaded.map((image) => image.url),
      ];
    }

    const coverFile = req.files?.coverImage?.[0];

    if (coverFile) {
      const uploadedCover = await uploadImage(coverFile);
      newlyUploaded.push(uploadedCover);
      villa.coverImage = uploadedCover.url;
    } else if (body.coverImage !== undefined) {
      villa.coverImage = body.coverImage;
    } else if (
      body.existingImages !== undefined &&
      !villa.images.includes(villa.coverImage)
    ) {
      villa.coverImage = villa.images[0] || "";
    }

    await villa.save();

    return res.status(200).json({
      success: true,
      message: "Villa updated successfully.",
      villa,
    });
  } catch (error) {
    await deleteCloudinaryImages(newlyUploaded);
    return sendError(res, error, "Update Villa");
  }
};

// =====================================================
// DELETE VILLA
// DELETE /api/vendor/villas/:id
// =====================================================

exports.deleteVilla = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid villa ID.",
      });
    }

    const villa = await Villa.findOneAndDelete({
      _id: req.params.id,
      vendor: vendorId,
    });

    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Villa deleted successfully.",
    });
  } catch (error) {
    return sendError(res, error, "Delete Villa");
  }
};

// =====================================================
// TOGGLE ACTIVE STATUS
// PATCH /api/vendor/villas/:id/toggle-status
// =====================================================

exports.toggleVillaStatus = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid villa ID.",
      });
    }

    const villa = await Villa.findOne({
      _id: req.params.id,
      vendor: vendorId,
    });

    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found.",
      });
    }

    villa.isActive = !villa.isActive;
    await villa.save();

    return res.status(200).json({
      success: true,
      message: `Villa ${villa.isActive ? "activated" : "deactivated"} successfully.`,
      villa,
    });
  } catch (error) {
    return sendError(res, error, "Toggle Villa Status");
  }
};

// =====================================================
// SUBMIT FOR APPROVAL
// PATCH /api/vendor/villas/:id/submit
// =====================================================

exports.submitVillaForApproval = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid villa ID.",
      });
    }

    const villa = await Villa.findOne({
      _id: req.params.id,
      vendor: vendorId,
    });

    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found.",
      });
    }

    if (villa.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Villa is already approved.",
      });
    }

    villa.status = "PENDING";
    villa.rejectionReason = "";

    await villa.save();

    return res.status(200).json({
      success: true,
      message: "Villa submitted for approval.",
      villa,
    });
  } catch (error) {
    return sendError(res, error, "Submit Villa For Approval");
  }
};
