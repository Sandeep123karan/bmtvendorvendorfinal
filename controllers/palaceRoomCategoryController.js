

const mongoose = require("mongoose");

const Palace = require("../models/palaceModel");
const PalaceRoomCategory = require("../models/palaceRoomCategoryModel");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../utils/uploadToCloudinary");

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const isValidId = (id) => mongoose.isValidObjectId(id);

const getVendorId = (req) => req.vendor?._id;

const parseJSON = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseAmenities = (value, fallback = []) => {
  const parsed = parseJSON(value, fallback);

  if (Array.isArray(parsed)) {
    return [
      ...new Set(
        parsed
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      ),
    ];
  }

  if (typeof parsed === "string") {
    return [
      ...new Set(
        parsed.split(",").map((item) => item.trim()).filter(Boolean)
      ),
    ];
  }

  return fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  if (value === 1 || value === 1) return true;
  if (value === 0) return false;

  return fallback;
};

const parseNumber = (value, field, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${field} must be a valid number`);
  }

  return number;
};

const getFiles = (req) => {
  if (Array.isArray(req.files)) return req.files;
  if (req.file) return [req.file];
  return [];
};

const uploadRoomImages = async (files) => {
  const uploaded = [];

  try {
    for (const file of files) {
      if (!file.mimetype?.startsWith("image/")) {
        throw new Error("Only image files are allowed");
      }

      if (!file.buffer) {
        throw new Error(
          "Image buffer missing. Check Multer memoryStorage configuration."
        );
      }

      // Existing helper accepts (buffer, folder)
      // and should return { url, publicId }.
      const result = await uploadToCloudinary(
        file.buffer,
        "bmt/palace-room-categories"
      );

      const url = result?.url;
      const publicId = result?.publicId || result?.public_id || "";

      if (!url) {
        throw new Error("Cloudinary did not return an image URL");
      }

      uploaded.push({ url, publicId });
    }

    return uploaded;
  } catch (error) {
    await cleanupImages(uploaded);
    throw error;
  }
};

const cleanupImages = async (images = []) => {
  const publicIds = [
    ...new Set(
      images
        .map((image) => image?.publicId || image?.public_id)
        .filter(Boolean)
    ),
  ];

  return Promise.allSettled(
    publicIds.map((publicId) => deleteFromCloudinary(publicId))
  );
};

const sendError = (res, error, label) => {
  console.error(`${label}:`, error);

  if (
    error.name === "ValidationError" ||
    error.name === "CastError" ||
    error.message?.includes("must be a valid number") ||
    error.message === "Only image files are allowed" ||
    error.message?.includes("Image buffer missing") ||
    error.message?.includes("Cloudinary did not return")
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

const validateCapacity = (data) => {
  if (data.includedAdults > data.maxAdults) {
    return "Included adults cannot exceed maximum adults";
  }

  if (data.maxGuests < data.includedAdults) {
    return "Maximum guests cannot be less than included adults";
  }

  if (
    data.maxGuests <
    data.maxAdults + data.maxChildren
  ) {
    return "Maximum guests cannot be less than max adults plus max children";
  }

  return null;
};

const buildRoomData = (body, existing = {}) => {
  const b = body;

  const data = {
    name:
      b.name !== undefined
        ? String(b.name).trim()
        : existing.name,

    description:
      b.description !== undefined
        ? String(b.description).trim()
        : existing.description || "",

    roomType: b.roomType ?? existing.roomType ?? "DELUXE",

    roomSize: parseNumber(
      b.roomSize,
      "roomSize",
      existing.roomSize ?? 0
    ),

    roomSizeUnit:
      b.roomSizeUnit ?? existing.roomSizeUnit ?? "SQFT",

    bedType:
      b.bedType !== undefined
        ? String(b.bedType).trim()
        : existing.bedType || "",

    bedCount: parseNumber(
      b.bedCount,
      "bedCount",
      existing.bedCount ?? 1
    ),

    includedAdults: parseNumber(
      b.includedAdults,
      "includedAdults",
      existing.includedAdults ?? 2
    ),

    maxAdults: parseNumber(
      b.maxAdults,
      "maxAdults",
      existing.maxAdults ?? 2
    ),

    maxChildren: parseNumber(
      b.maxChildren,
      "maxChildren",
      existing.maxChildren ?? 0
    ),

    maxGuests: parseNumber(
      b.maxGuests,
      "maxGuests",
      existing.maxGuests ??
        (
          parseNumber(b.maxAdults, "maxAdults", 2) +
          parseNumber(b.maxChildren, "maxChildren", 0)
        )
    ),

    maxExtraMattress: parseNumber(
      b.maxExtraMattress,
      "maxExtraMattress",
      existing.maxExtraMattress ?? 0
    ),

    extraMattressAllowed: parseBoolean(
      b.extraMattressAllowed,
      existing.extraMattressAllowed ?? false
    ),

    totalUnits: parseNumber(
      b.totalUnits,
      "totalUnits",
      existing.totalUnits ?? 1
    ),

    amenities:
      b.amenities !== undefined
        ? parseAmenities(b.amenities)
        : existing.amenities || [],
  };

  if (!data.name) {
    throw new Error("Room category name is required");
  }

  if (!Number.isInteger(data.bedCount) || data.bedCount < 1) {
    throw new Error("bedCount must be an integer greater than 0");
  }

  if (!Number.isInteger(data.totalUnits) || data.totalUnits < 1) {
    throw new Error("totalUnits must be an integer greater than 0");
  }

  const integerFields = [
    "includedAdults",
    "maxAdults",
    "maxChildren",
    "maxGuests",
    "maxExtraMattress",
  ];

  for (const field of integerFields) {
    if (!Number.isInteger(data[field])) {
      throw new Error(`${field} must be an integer`);
    }
  }

  const capacityError = validateCapacity(data);

  if (capacityError) {
    throw new Error(capacityError);
  }

  return data;
};

// --------------------------------------------------
// CREATE
// POST /api/palace-room-categories
// FormData: palaceId, name, other fields, images
// --------------------------------------------------

exports.createRoomCategory = async (req, res) => {
  let uploadedImages = [];

  try {
    const vendorId = getVendorId(req);
    const { palaceId } = req.body;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    if (!isValidId(palaceId)) {
      return res.status(400).json({
        success: false,
        message: "A valid palaceId is required",
      });
    }

    const palace = await Palace.findOne({
      _id: palaceId,
      vendor: vendorId,
    }).select("_id");

    if (!palace) {
      return res.status(404).json({
        success: false,
        message: "Palace not found or access denied",
      });
    }

    const roomData = buildRoomData(req.body);

    uploadedImages = await uploadRoomImages(getFiles(req));

    const roomCategory = await PalaceRoomCategory.create({
      ...roomData,
      vendor: vendorId,
      palace: palace._id,
      images: uploadedImages,
      coverImage: uploadedImages[0] || {
        url: "",
        publicId: "",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Room category created successfully",
      data: roomCategory,
    });
  } catch (error) {
    await cleanupImages(uploadedImages);
    return sendError(res, error, "CREATE ROOM CATEGORY ERROR");
  }
};

// --------------------------------------------------
// GET ALL FOR A PALACE
// GET /api/palace-room-categories/palace/:palaceId
// --------------------------------------------------

exports.getRoomCategoriesByPalace = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { palaceId } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    if (!isValidId(palaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid palace ID",
      });
    }

    const palace = await Palace.findOne({
      _id: palaceId,
      vendor: vendorId,
    }).select("_id propertyName");

    if (!palace) {
      return res.status(404).json({
        success: false,
        message: "Palace not found or access denied",
      });
    }

    const rooms = await PalaceRoomCategory.find({
      palace: palace._id,
      vendor: vendorId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: rooms.length,
      palace,
      data: rooms,
    });
  } catch (error) {
    return sendError(res, error, "GET ROOM CATEGORIES ERROR");
  }
};

// --------------------------------------------------
// GET SINGLE
// GET /api/palace-room-categories/:id
// --------------------------------------------------

exports.getRoomCategoryById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room category ID",
      });
    }

    const room = await PalaceRoomCategory.findOne({
      _id: id,
      vendor: vendorId,
    }).populate("palace", "propertyName");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    return sendError(res, error, "GET ROOM CATEGORY ERROR");
  }
};

// --------------------------------------------------
// UPDATE
// PUT /api/palace-room-categories/:id
// New uploaded images are appended to existing images.
// --------------------------------------------------

exports.updateRoomCategory = async (req, res) => {
  let uploadedImages = [];

  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room category ID",
      });
    }

    const room = await PalaceRoomCategory.findOne({
      _id: id,
      vendor: vendorId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room category not found",
      });
    }

    const roomData = buildRoomData(req.body, room.toObject());

    uploadedImages = await uploadRoomImages(getFiles(req));

    room.set(roomData);

    if (uploadedImages.length > 0) {
      room.images = [
        ...(room.images || []).map((image) => ({
          url: image.url,
          publicId: image.publicId || "",
        })),
        ...uploadedImages,
      ];

      if (!room.coverImage?.url) {
        room.coverImage = uploadedImages[0];
      }
    }

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room category updated successfully",
      data: room,
    });
  } catch (error) {
    await cleanupImages(uploadedImages);
    return sendError(res, error, "UPDATE ROOM CATEGORY ERROR");
  }
};

// --------------------------------------------------
// DELETE
// DELETE /api/palace-room-categories/:id
// --------------------------------------------------

exports.deleteRoomCategory = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room category ID",
      });
    }

    // Delete only a category owned by the authenticated vendor.
    const room = await PalaceRoomCategory.findOneAndDelete({
      _id: id,
      vendor: vendorId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room category not found",
      });
    }

    const images = [
      ...(room.images || []),
      room.coverImage,
    ];

    const cleanupResults = await cleanupImages(images);

    const cleanupFailed = cleanupResults.some(
      (result) => result.status === "rejected"
    );

    return res.status(200).json({
      success: true,
      message: cleanupFailed
        ? "Room category deleted, but some Cloudinary images may need cleanup"
        : "Room category and its images deleted successfully",
    });
  } catch (error) {
    return sendError(res, error, "DELETE ROOM CATEGORY ERROR");
  }
};

// --------------------------------------------------
// TOGGLE ACTIVE / INACTIVE
// PATCH /api/palace-room-categories/:id/toggle
// --------------------------------------------------

exports.toggleRoomCategory = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room category ID",
      });
    }

    const room = await PalaceRoomCategory.findOne({
      _id: id,
      vendor: vendorId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room category not found",
      });
    }

    room.isActive = !room.isActive;
    await room.save();

    return res.status(200).json({
      success: true,
      message: `Room category ${
        room.isActive ? "activated" : "deactivated"
      } successfully`,
      data: room,
    });
  } catch (error) {
    return sendError(res, error, "TOGGLE ROOM CATEGORY ERROR");
  }
};
