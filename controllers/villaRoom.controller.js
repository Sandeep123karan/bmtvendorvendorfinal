
const mongoose = require("mongoose");
const Villa = require("../models/Villa.model");
const VillaRoom = require("../models/VillaRoom.model");
const cloudinary = require("../config/cloudinary");

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getVendorId = (req) =>
  req.vendor?._id ||
  req.vendor?.id ||
  req.user?.vendorId ||
  req.user?._id ||
  req.user?.id ||
  req.vendorId ||
  null;

const parseArray = (value, fallback = []) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return value === true || value === "true" || value === "1";
};

const parseNumber = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const getFiles = (req, fieldName) => {
  if (!req.files) return [];

  // upload.fields() returns an object of arrays
  if (!Array.isArray(req.files)) {
    return req.files[fieldName] || [];
  }

  // upload.array() / upload.any() returns an array
  return req.files.filter((file) => file.fieldname === fieldName);
};

const uploadToCloudinary = (file, folder) =>
  new Promise((resolve, reject) => {
    if (!file?.buffer) {
      return reject(new Error("Image file buffer is missing."));
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
      },
      (error, result) => {
        if (error) return reject(error);

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.end(file.buffer);
  });

const uploadImages = async (files, folder) => {
  const uploaded = [];

  try {
    for (const file of files) {
      if (!file.mimetype?.startsWith("image/")) {
        throw new Error("Only image files are allowed.");
      }

      uploaded.push(await uploadToCloudinary(file, folder));
    }

    return uploaded;
  } catch (error) {
    // Clean up newly uploaded files if the upload batch fails.
    await Promise.allSettled(
      uploaded.map((image) =>
        cloudinary.uploader.destroy(image.publicId)
      )
    );

    throw error;
  }
};

const deleteCloudinaryImages = async (publicIds = []) => {
  const ids = [...new Set(publicIds.filter(Boolean))];

  await Promise.allSettled(
    ids.map((publicId) => cloudinary.uploader.destroy(publicId))
  );
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getOwnedVilla = async (villaId, vendorId) => {
  if (!isValidId(villaId)) return null;

  return Villa.findOne({
    _id: villaId,
    vendor: vendorId,
  });
};

const getOwnedRoom = async (villaId, roomId, vendorId) => {
  if (!isValidId(roomId)) return null;

  return VillaRoom.findOne({
    _id: roomId,
    villa: villaId,
    vendor: vendorId,
  });
};

const sendError = (res, error, fallbackMessage) => {
  console.error("Villa Room Controller Error:", error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID or field value.",
    });
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

// --------------------------------------------------
// CREATE ROOM
// POST /api/vendor/villas/:villaId/rooms
// --------------------------------------------------

exports.createVillaRoom = async (req, res) => {
  let uploadedImages = [];

  try {
    const vendorId = getVendorId(req);
    const { villaId } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    if (!isValidId(vendorId) || !isValidId(villaId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor or villa ID.",
      });
    }

    const villa = await getOwnedVilla(villaId, vendorId);

    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found or you do not own this villa.",
      });
    }

    const {
      roomName,
      roomNumber,
      roomType,
      description,
      bedType,
      bedCount,
      maxGuests,
      maxAdults,
      maxChildren,
      floorNumber,
      roomSize,
      roomSizeUnit,
      totalRooms,
      bookedRooms,
      blockedRooms,
      pricePerNight,
      weekendPrice,
      extraGuestAllowed,
      extraGuestCharge,
      descriptionNotes,
    } = req.body;

    if (!roomName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Room name is required.",
      });
    }

    if (
      parseNumber(maxGuests, NaN) < 1 ||
      parseNumber(totalRooms, 1) < 1 ||
      parseNumber(pricePerNight, NaN) < 0 ||
      !Number.isFinite(parseNumber(pricePerNight, NaN))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid guest capacity, total rooms and nightly price are required.",
      });
    }

    const galleryFiles = getFiles(req, "images");
    const coverFiles = getFiles(req, "coverImage");

    // Cover can be uploaded separately or selected from gallery.
    if (coverFiles.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Upload only one cover image.",
      });
    }

    const folder = `birdmytrip/villas/${villaId}/rooms`;

    const galleryUploads = await uploadImages(galleryFiles, folder);
    uploadedImages.push(...galleryUploads);

    const coverUploads = await uploadImages(coverFiles, folder);
    uploadedImages.push(...coverUploads);

    const amenities = parseArray(req.body.amenities, []);

    const booked = parseNumber(bookedRooms, 0);
    const blocked = parseNumber(blockedRooms, 0);
    const total = parseNumber(totalRooms, 1);

    if (
      !Number.isInteger(total) ||
      !Number.isInteger(booked) ||
      !Number.isInteger(blocked) ||
      booked < 0 ||
      blocked < 0 ||
      booked + blocked > total
    ) {
      await deleteCloudinaryImages(
        uploadedImages.map((image) => image.publicId)
      );

      return res.status(400).json({
        success: false,
        message: "Invalid inventory: booked and blocked rooms cannot exceed total rooms.",
      });
    }

    const room = await VillaRoom.create({
      villa: villaId,
      vendor: vendorId,
      roomName: roomName.trim(),
      roomNumber,
      roomType,
      description,
      bedType,
      bedCount: parseNumber(bedCount, 1),
      maxGuests: parseNumber(maxGuests, NaN),
      maxAdults: parseNumber(maxAdults, 2),
      maxChildren: parseNumber(maxChildren, 0),
      floorNumber,
      roomSize: parseNumber(roomSize, 0),
      roomSizeUnit,
      totalRooms: total,
      bookedRooms: booked,
      blockedRooms: blocked,
      availableRooms: total - booked - blocked,
      pricePerNight: parseNumber(pricePerNight, NaN),
      weekendPrice: parseNumber(weekendPrice, 0),
      extraGuestAllowed: parseBoolean(extraGuestAllowed),
      extraGuestCharge: parseNumber(extraGuestCharge, 0),
      amenities: amenities.map(String),
      descriptionNotes,

      coverImage: coverUploads[0]?.url || galleryUploads[0]?.url || "",
      coverImagePublicId:
        coverUploads[0]?.publicId || galleryUploads[0]?.publicId || "",

      images: galleryUploads.map((image) => image.url),
      imagePublicIds: galleryUploads.map((image) => image.publicId),

      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Villa room created successfully.",
      room,
    });
  } catch (error) {
    await deleteCloudinaryImages(
      uploadedImages.map((image) => image.publicId)
    );

    return sendError(res, error, "Failed to create villa room.");
  }
};

// --------------------------------------------------
// GET ALL ROOMS FOR A VILLA
// GET /api/vendor/villas/:villaId/rooms
// --------------------------------------------------

exports.getVillaRooms = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { villaId } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const villa = await getOwnedVilla(villaId, vendorId);

    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found.",
      });
    }

    const rooms = await VillaRoom.find({
      villa: villaId,
      vendor: vendorId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: rooms.length,
      rooms,
    });
  } catch (error) {
    return sendError(res, error, "Failed to fetch villa rooms.");
  }
};

// --------------------------------------------------
// GET SINGLE ROOM
// GET /api/vendor/villas/:villaId/rooms/:roomId
// --------------------------------------------------

exports.getVillaRoomById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { villaId, roomId } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const room = await getOwnedRoom(villaId, roomId, vendorId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    return res.status(200).json({
      success: true,
      room,
    });
  } catch (error) {
    return sendError(res, error, "Failed to fetch villa room.");
  }
};

// --------------------------------------------------
// UPDATE ROOM
// PUT /api/vendor/villas/:villaId/rooms/:roomId
// --------------------------------------------------

exports.updateVillaRoom = async (req, res) => {
  let uploadedImages = [];

  try {
    const vendorId = getVendorId(req);
    const { villaId, roomId } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const room = await getOwnedRoom(villaId, roomId, vendorId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    const body = req.body;

    const galleryFiles = getFiles(req, "images");
    const coverFiles = getFiles(req, "coverImage");

    if (coverFiles.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Upload only one cover image.",
      });
    }

    const folder = `birdmytrip/villas/${villaId}/rooms`;

    const galleryUploads = await uploadImages(galleryFiles, folder);
    uploadedImages.push(...galleryUploads);

    const coverUploads = await uploadImages(coverFiles, folder);
    uploadedImages.push(...coverUploads);

    // Frontend sends the URLs it wants to keep.
    // If omitted, existing images are preserved.
    const existingImages = body.existingImages !== undefined
      ? parseArray(body.existingImages, [])
      : [...room.images];

    const existingPublicIds = body.existingImagePublicIds !== undefined
      ? parseArray(body.existingImagePublicIds, [])
      : [...room.imagePublicIds];

    // Keep only URLs belonging to this room already.
    const safeExistingImages = existingImages.filter((url) =>
      room.images.includes(url)
    );

    const safeExistingPublicIds = existingPublicIds.filter((id) =>
      room.imagePublicIds.includes(id)
    );

    const nextImages = [
      ...safeExistingImages,
      ...galleryUploads.map((image) => image.url),
    ];

    const nextImagePublicIds = [
      ...safeExistingPublicIds,
      ...galleryUploads.map((image) => image.publicId),
    ];

    // Cover can be replaced by a new upload or preserved.
    const requestedCover = body.existingCoverImage;
    const preserveCover =
      requestedCover === undefined || requestedCover === ""
        ? room.coverImage
        : requestedCover;

    const coverIsKept =
      preserveCover === room.coverImage ||
      nextImages.includes(preserveCover);

    const nextCoverImage = coverUploads[0]?.url ||
      (coverIsKept ? preserveCover : "") ||
      nextImages[0] ||
      "";

    const nextCoverPublicId = coverUploads[0]?.publicId ||
      (nextCoverImage === room.coverImage
        ? room.coverImagePublicId
        : nextImages.includes(nextCoverImage)
          ? nextImagePublicIds[nextImages.indexOf(nextCoverImage)] || ""
          : "");

    const allowedFields = [
      "roomName",
      "roomNumber",
      "roomType",
      "description",
      "bedType",
      "floorNumber",
      "roomSizeUnit",
      "descriptionNotes",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        room[field] = body[field];
      }
    }

    const numericFields = [
      "bedCount",
      "maxGuests",
      "maxAdults",
      "maxChildren",
      "roomSize",
      "totalRooms",
      "bookedRooms",
      "blockedRooms",
      "pricePerNight",
      "weekendPrice",
      "extraGuestCharge",
    ];

    for (const field of numericFields) {
      if (body[field] !== undefined) {
        const value = parseNumber(body[field], NaN);

        if (!Number.isFinite(value)) {
          await deleteCloudinaryImages(
            uploadedImages.map((image) => image.publicId)
          );

          return res.status(400).json({
            success: false,
            message: `Invalid numeric value for ${field}.`,
          });
        }

        room[field] = value;
      }
    }

    if (body.extraGuestAllowed !== undefined) {
      room.extraGuestAllowed = parseBoolean(body.extraGuestAllowed);
    }

    if (body.isActive !== undefined) {
      room.isActive = parseBoolean(body.isActive);
    }

    if (body.amenities !== undefined) {
      room.amenities = parseArray(body.amenities, []);
    }

    room.images = nextImages;
    room.imagePublicIds = nextImagePublicIds;
    room.coverImage = nextCoverImage;
    room.coverImagePublicId = nextCoverPublicId;

    await room.save();

    // Delete old Cloudinary assets only after successful save.
    const keepPublicIds = new Set([
      ...room.imagePublicIds,
      room.coverImagePublicId,
    ].filter(Boolean));

    const oldPublicIds = [
      ...new Set([
        ...(room._originalImagePublicIds || []),
      ]),
    ];

    // Remove assets that were previously attached but are no longer used.
    const removedPublicIds = [
      ...new Set([
        ...oldPublicIds,
      ]),
    ].filter((id) => !keepPublicIds.has(id));

    await deleteCloudinaryImages(removedPublicIds);

    return res.status(200).json({
      success: true,
      message: "Villa room updated successfully.",
      room,
    });
  } catch (error) {
    await deleteCloudinaryImages(
      uploadedImages.map((image) => image.publicId)
    );

    return sendError(res, error, "Failed to update villa room.");
  }
};

// --------------------------------------------------
// DELETE ROOM
// DELETE /api/vendor/villas/:villaId/rooms/:roomId
// --------------------------------------------------

exports.deleteVillaRoom = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { villaId, roomId } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const room = await getOwnedRoom(villaId, roomId, vendorId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    const publicIds = [
      room.coverImagePublicId,
      ...(room.imagePublicIds || []),
    ].filter(Boolean);

    await room.deleteOne();

    // Only remove Cloudinary images belonging to this room.
    await deleteCloudinaryImages(publicIds);

    return res.status(200).json({
      success: true,
      message: "Villa room and its images deleted successfully.",
    });
  } catch (error) {
    return sendError(res, error, "Failed to delete villa room.");
  }
};

// --------------------------------------------------
// TOGGLE ROOM STATUS
// PATCH /api/vendor/villas/:villaId/rooms/:roomId/toggle-status
// --------------------------------------------------

exports.toggleVillaRoomStatus = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { villaId, roomId } = req.params;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const room = await getOwnedRoom(villaId, roomId, vendorId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    room.isActive = !room.isActive;
    await room.save();

    return res.status(200).json({
      success: true,
      message: `Room ${room.isActive ? "activated" : "deactivated"} successfully.`,
      room,
    });
  } catch (error) {
    return sendError(res, error, "Failed to change room status.");
  }
};
