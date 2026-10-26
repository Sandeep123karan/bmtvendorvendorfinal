
const mongoose = require("mongoose");
const Palace = require("../models/palaceModel");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../utils/uploadToCloudinary");

// ---------------------------------------------
// HELPERS
// ---------------------------------------------

const parseJSON = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  return fallback;
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const getUploadedFiles = (req) =>
  Array.isArray(req.files) ? req.files : [];

const uploadPalaceImages = async (files) => {
  const uploaded = [];

  try {
    for (const file of files) {
      if (!file.mimetype?.startsWith("image/")) {
        throw new Error("Only image files are allowed");
      }

      const image = await uploadToCloudinary(
        file.buffer,
        "bmt/palaces"
      );

      uploaded.push(image);
    }

    return uploaded;
  } catch (error) {
    // Clean up assets uploaded before a later upload failed.
    await Promise.allSettled(
      uploaded.map((image) =>
        deleteFromCloudinary(image.publicId)
      )
    );

    throw error;
  }
};

const cleanupImages = async (images = []) => {
  const publicIds = [
    ...new Set(
      images
        .map((image) => image?.publicId)
        .filter(Boolean)
    ),
  ];

  return Promise.allSettled(
    publicIds.map((publicId) =>
      deleteFromCloudinary(publicId)
    )
  );
};

const sendError = (res, error, label) => {
  console.error(`${label}:`, error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID or field value",
    });
  }

  if (error.message === "Only image files are allowed") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
};

// ---------------------------------------------
// CREATE PALACE
// POST /api/palaces
// No admin approval: goes live immediately.
// ---------------------------------------------

exports.createPalace = async (req, res) => {
  let uploadedImages = [];

  try {
    const b = req.body;

    if (!b.propertyName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "propertyName is required",
      });
    }

    if (
      b.starRating !== undefined &&
      (Number(b.starRating) < 1 ||
        Number(b.starRating) > 5)
    ) {
      return res.status(400).json({
        success: false,
        message: "starRating must be between 1 and 5",
      });
    }

    uploadedImages = await uploadPalaceImages(
      getUploadedFiles(req)
    );

    const palace = await Palace.create({
      vendor: req.vendor._id,

      propertyName: b.propertyName.trim(),
      propertyType: b.propertyType || "heritage-palace",
      shortDescription: b.shortDescription || "",
      description: b.description || "",
      starRating:
        b.starRating === undefined
          ? 3
          : Number(b.starRating),

      contact: {
        phone: b.phone || "",
        alternatePhone: b.alternatePhone || "",
        email: b.email || "",
      },

      address: {
        addressLine: b.addressLine || b.fullAddress || "",
        landmark: b.landmark || "",
        city: b.city || "",
        state: b.state || "",
        country: b.country || "India",
        pincode: b.pincode || "",
        latitude:
          b.latitude !== undefined && b.latitude !== ""
            ? Number(b.latitude)
            : null,
        longitude:
          b.longitude !== undefined && b.longitude !== ""
            ? Number(b.longitude)
            : null,
      },

      totalRooms: Number(b.totalRooms || 0),
      heritageCertified: toBoolean(b.heritageCertified),
      weddingAllowed: toBoolean(b.weddingAllowed),
      eventAllowed: toBoolean(b.eventAllowed),

      checkInTime: b.checkInTime || "14:00",
      checkOutTime: b.checkOutTime || "11:00",

      amenities: parseJSON(b.amenities, []),

      images: uploadedImages,
      coverImage: uploadedImages[0] || {
        url: "",
        publicId: "",
      },

      policies: parseJSON(b.policies, {
        cancellationPolicy: "",
        childPolicy: "",
        petPolicy: "",
        smokingPolicy: "",
        unmarriedCouplesAllowed: false,
        localIdAllowed: false,
        idProofRequired: true,
      }),

      // No admin approval needed: live immediately
      status: "APPROVED",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Palace created successfully",
      data: palace,
    });
  } catch (error) {
    // Remove newly uploaded images if database creation fails.
    if (uploadedImages.length) {
      await cleanupImages(uploadedImages);
    }

    return sendError(res, error, "CREATE PALACE ERROR");
  }
};

// ---------------------------------------------
// GET MY PALACES
// GET /api/palaces
// Old DRAFT / PENDING / REJECTED palaces are
// automatically made live (no approval flow).
// ---------------------------------------------

exports.getMyPalaces = async (req, res) => {
  try {
    await Palace.updateMany(
      {
        vendor: req.vendor._id,
        status: { $in: ["DRAFT", "PENDING", "REJECTED"] },
      },
      {
        $set: {
          status: "APPROVED",
          isActive: true,
          rejectionReason: "",
        },
      }
    );

    const palaces = await Palace.find({
      vendor: req.vendor._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: palaces.length,
      data: palaces,
    });
  } catch (error) {
    return sendError(res, error, "GET MY PALACES ERROR");
  }
};

// ---------------------------------------------
// GET SINGLE PALACE
// GET /api/palaces/:id
// ---------------------------------------------

exports.getPalaceById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid palace ID",
      });
    }

    const palace = await Palace.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!palace) {
      return res.status(404).json({
        success: false,
        message: "Palace not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: palace,
    });
  } catch (error) {
    return sendError(res, error, "GET PALACE ERROR");
  }
};

// ---------------------------------------------
// UPDATE PALACE
// PUT /api/palaces/:id
// ---------------------------------------------

exports.updatePalace = async (req, res) => {
  let newImages = [];

  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid palace ID",
      });
    }

    const b = req.body;

    const palace = await Palace.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!palace) {
      return res.status(404).json({
        success: false,
        message: "Palace not found",
      });
    }

    newImages = await uploadPalaceImages(
      getUploadedFiles(req)
    );

    if (newImages.length) {
      palace.images = [
        ...(palace.images || []),
        ...newImages,
      ];

      if (!palace.coverImage?.url) {
        palace.coverImage = newImages[0];
      }
    }

    const stringFields = [
      "propertyName",
      "propertyType",
      "shortDescription",
      "description",
      "checkInTime",
      "checkOutTime",
    ];

    for (const field of stringFields) {
      if (b[field] !== undefined) {
        palace[field] =
          field === "propertyName"
            ? b[field].trim()
            : b[field];
      }
    }

    if (b.starRating !== undefined) {
      palace.starRating = Number(b.starRating);
    }

    if (b.phone !== undefined) {
      palace.contact.phone = b.phone;
    }

    if (b.alternatePhone !== undefined) {
      palace.contact.alternatePhone = b.alternatePhone;
    }

    if (b.email !== undefined) {
      palace.contact.email = b.email;
    }

    if (b.addressLine !== undefined) {
      palace.address.addressLine = b.addressLine;
    }

    if (b.fullAddress !== undefined) {
      palace.address.addressLine = b.fullAddress;
    }

    for (const field of [
      "landmark",
      "city",
      "state",
      "country",
      "pincode",
    ]) {
      if (b[field] !== undefined) {
        palace.address[field] = b[field];
      }
    }

    for (const field of ["latitude", "longitude"]) {
      if (b[field] !== undefined) {
        palace.address[field] =
          b[field] === "" ? null : Number(b[field]);
      }
    }

    if (b.totalRooms !== undefined) {
      palace.totalRooms = Number(b.totalRooms);
    }

    for (const field of [
      "heritageCertified",
      "weddingAllowed",
      "eventAllowed",
    ]) {
      if (b[field] !== undefined) {
        palace[field] = toBoolean(b[field]);
      }
    }

    if (b.amenities !== undefined) {
      palace.amenities = parseJSON(
        b.amenities,
        palace.amenities
      );
    }

    if (b.policies !== undefined) {
      palace.policies = {
        ...palace.policies.toObject(),
        ...parseJSON(b.policies, {}),
      };
    }

    // No admin approval: legacy non-live palaces become live on save
    if (["DRAFT", "PENDING", "REJECTED"].includes(palace.status)) {
      palace.status = "APPROVED";
      palace.isActive = true;
      palace.rejectionReason = "";
    }

    await palace.save();

    return res.status(200).json({
      success: true,
      message: "Palace updated successfully",
      data: palace,
    });
  } catch (error) {
    // If saving fails, clean up only images uploaded in this request.
    if (newImages.length) {
      await cleanupImages(newImages);
    }

    return sendError(res, error, "UPDATE PALACE ERROR");
  }
};

// ---------------------------------------------
// SET COVER IMAGE
// PATCH /api/palaces/:id/cover
// Body: { "publicId": "bmt/palaces/..." }
// ---------------------------------------------

exports.setCoverImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { publicId } = req.body;

    if (!isValidId(id) || !publicId) {
      return res.status(400).json({
        success: false,
        message: "Valid palace ID and publicId are required",
      });
    }

    const palace = await Palace.findOne({
      _id: id,
      vendor: req.vendor._id,
    });

    if (!palace) {
      return res.status(404).json({
        success: false,
        message: "Palace not found",
      });
    }

    const image = palace.images.find(
      (item) => item.publicId === publicId
    );

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found in this palace gallery",
      });
    }

    palace.coverImage = {
      url: image.url,
      publicId: image.publicId,
    };

    await palace.save();

    return res.status(200).json({
      success: true,
      message: "Cover image updated successfully",
      data: palace,
    });
  } catch (error) {
    return sendError(res, error, "SET COVER IMAGE ERROR");
  }
};

// ---------------------------------------------
// DELETE ONE GALLERY IMAGE
// DELETE /api/palaces/:id/images
// Body: { "publicId": "bmt/palaces/..." }
// ---------------------------------------------

exports.deletePalaceImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { publicId } = req.body;

    if (!isValidId(id) || !publicId) {
      return res.status(400).json({
        success: false,
        message: "Valid palace ID and publicId are required",
      });
    }

    const palace = await Palace.findOne({
      _id: id,
      vendor: req.vendor._id,
    });

    if (!palace) {
      return res.status(404).json({
        success: false,
        message: "Palace not found",
      });
    }

    const image = palace.images.find(
      (item) => item.publicId === publicId
    );

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found in this palace gallery",
      });
    }

    // Delete Cloudinary asset first.
    const result = await deleteFromCloudinary(publicId);

    if (result && !["ok", "not found"].includes(result.result)) {
      return res.status(502).json({
        success: false,
        message: "Cloudinary image deletion failed",
      });
    }

    palace.images = palace.images.filter(
      (item) => item.publicId !== publicId
    );

    if (palace.coverImage?.publicId === publicId) {
      palace.coverImage = palace.images[0]
        ? {
            url: palace.images[0].url,
            publicId: palace.images[0].publicId,
          }
        : {
            url: "",
            publicId: "",
          };
    }

    await palace.save();

    return res.status(200).json({
      success: true,
      message: "Palace image deleted successfully",
      data: palace,
    });
  } catch (error) {
    return sendError(res, error, "DELETE PALACE IMAGE ERROR");
  }
};

// ---------------------------------------------
// DELETE PALACE
// DELETE /api/palaces/:id
// ---------------------------------------------

exports.deletePalace = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid palace ID",
      });
    }

    const palace = await Palace.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!palace) {
      return res.status(404).json({
        success: false,
        message: "Palace not found",
      });
    }

    const imagesToDelete = [
      ...(palace.images || []),
      palace.coverImage,
    ];

    await Palace.deleteOne({
      _id: palace._id,
      vendor: req.vendor._id,
    });

    // Gallery and cover can refer to the same asset.
    const cleanupResults = await cleanupImages(imagesToDelete);
    const cleanupFailed = cleanupResults.some(
      (item) => item.status === "rejected"
    );

    return res.status(200).json({
      success: true,
      message: cleanupFailed
        ? "Palace deleted; some Cloudinary assets may need cleanup"
        : "Palace and its images deleted successfully",
    });
  } catch (error) {
    return sendError(res, error, "DELETE PALACE ERROR");
  }
};

// ---------------------------------------------
// ACTIVATE / DEACTIVATE PALACE
// PATCH /api/palaces/:id/toggle
// APPROVED <-> INACTIVE
// ---------------------------------------------

exports.togglePalaceStatus = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid palace ID",
      });
    }

    const palace = await Palace.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!palace) {
      return res.status(404).json({
        success: false,
        message: "Palace not found",
      });
    }

    // Legacy non-live palaces: treat as live, so toggle deactivates them
    if (["DRAFT", "PENDING", "REJECTED"].includes(palace.status)) {
      palace.status = "APPROVED";
      palace.rejectionReason = "";
    }

    palace.status =
      palace.status === "APPROVED"
        ? "INACTIVE"
        : "APPROVED";

    palace.isActive = palace.status === "APPROVED";

    await palace.save();

    return res.status(200).json({
      success: true,
      message: "Palace status updated successfully",
      data: palace,
    });
  } catch (error) {
    return sendError(res, error, "TOGGLE PALACE ERROR");
  }
};