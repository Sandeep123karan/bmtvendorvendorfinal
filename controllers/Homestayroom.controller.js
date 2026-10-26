const HomestayRoom = require("../models/Homestayroom.model");
const Homestay = require("../models/Homestay.model");
const cloudinary = require("../config/cloudinary");

/* ============================================================
   HELPERS
============================================================ */

const parseArray = (value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch (error) {
      return value.split(",").map((i) => i.trim()).filter(Boolean);
    }
  }
  return [];
};

const toNumber = (value, defaultValue = undefined) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  const n = Number(value);
  return Number.isNaN(n) ? defaultValue : n;
};

const uploadMany = async (files = [], folder) => {
  const urls = [];
  for (const file of files) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: "auto",
    });
    urls.push(result.secure_url);
  }
  return urls;
};

const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    const parts = imageUrl.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return;
    let publicPath = parts.slice(uploadIndex + 1).join("/");
    publicPath = publicPath.replace(/^v\d+\//, "");
    publicPath = publicPath.replace(/\.[^/.]+$/, "");
    await cloudinary.uploader.destroy(publicPath, { resource_type: "image" });
  } catch (error) {
    console.error("Cloudinary delete error:", error.message);
  }
};

const requireVendor = (req, res) => {
  const vendorId = req.vendor?._id;
  if (!vendorId) {
    res.status(401).json({ success: false, message: "Vendor authentication required." });
    return null;
  }
  return vendorId;
};

const STRING_FIELDS = ["roomName", "roomType", "description", "bedType", "view", "mealPlan"];
const NUMBER_FIELDS = ["totalRooms", "maxGuests", "maxAdults", "maxChildren", "totalBeds", "bathrooms", "roomSize"];
const PRICE_FIELDS = ["basePrice", "weekendPrice", "extraGuestPrice", "extraBedPrice"];

/* body -> plain object (sirf wahi fields jo bheji gayi hain) */
const pickRoomFields = (body) => {
  const out = { pricing: {} };

  STRING_FIELDS.forEach((k) => {
    if (body[k] !== undefined) out[k] = typeof body[k] === "string" ? body[k].trim() : body[k];
  });

  NUMBER_FIELDS.forEach((k) => {
    const n = toNumber(body[k]);
    if (n !== undefined) out[k] = n;
  });

  PRICE_FIELDS.forEach((k) => {
    const n = toNumber(body[k]);
    if (n !== undefined) out.pricing[k] = n;
  });

  if (body.amenities !== undefined) out.amenities = parseArray(body.amenities);

  return out;
};

/* ============================================================
   GET ROOMS   (GET /?homestay=<id>)
============================================================ */

exports.getRooms = async (req, res) => {
  try {
    const vendorId = requireVendor(req, res);
    if (!vendorId) return;

    const filter = { vendor: vendorId };
    if (req.query.homestay) filter.homestay = req.query.homestay;

    const rooms = await HomestayRoom.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ success: true, total: rooms.length, rooms });
  } catch (error) {
    console.error("Get Rooms Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch rooms.", error: error.message });
  }
};

/* ============================================================
   CREATE ROOM   (POST /)  -- multipart: images[], homestay, ...
============================================================ */

exports.createRoom = async (req, res) => {
  try {
    const vendorId = requireVendor(req, res);
    if (!vendorId) return;

    const { homestay: homestayId } = req.body;

    if (!homestayId) {
      return res.status(400).json({ success: false, message: "Homestay is required." });
    }

    const homestay = await Homestay.findOne({ _id: homestayId, vendor: vendorId }).select("_id");
    if (!homestay) {
      return res.status(404).json({ success: false, message: "Homestay not found." });
    }

    const fields = pickRoomFields(req.body);

    if (!fields.roomName) {
      return res.status(400).json({ success: false, message: "Room name is required." });
    }

    if (fields.pricing.basePrice === undefined || fields.pricing.basePrice <= 0) {
      return res.status(400).json({ success: false, message: "Base price is required." });
    }

    const duplicate = await HomestayRoom.findOne({
      homestay: homestayId,
      roomName: { $regex: `^${fields.roomName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: "Is homestay me is naam ka room pehle se hai." });
    }

    const images = req.files?.length ? await uploadMany(req.files, "homestays/rooms") : [];

    const room = await HomestayRoom.create({
      ...fields,
      vendor: vendorId,
      homestay: homestayId,
      images,
    });

    return res.status(201).json({ success: true, message: "Room added successfully.", room });
  } catch (error) {
    console.error("Create Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create room.", error: error.message });
  }
};

/* ============================================================
   UPDATE ROOM   (PUT /:id)
============================================================ */

exports.updateRoom = async (req, res) => {
  try {
    const vendorId = requireVendor(req, res);
    if (!vendorId) return;

    const room = await HomestayRoom.findOne({ _id: req.params.id, vendor: vendorId });
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found." });
    }

    const fields = pickRoomFields(req.body);

    if (fields.roomName === "") {
      return res.status(400).json({ success: false, message: "Room name cannot be empty." });
    }

    const { pricing, ...rest } = fields;

    Object.entries(rest).forEach(([k, v]) => {
      room[k] = v;
    });

    Object.entries(pricing).forEach(([k, v]) => {
      room.pricing[k] = v;
    });

    if (!room.pricing.basePrice || room.pricing.basePrice <= 0) {
      return res.status(400).json({ success: false, message: "Base price is required." });
    }

    if (req.files?.length) {
      const uploaded = await uploadMany(req.files, "homestays/rooms");
      room.images.push(...uploaded);
    }

    await room.save();

    return res.status(200).json({ success: true, message: "Room updated successfully.", room });
  } catch (error) {
    console.error("Update Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update room.", error: error.message });
  }
};

/* ============================================================
   DELETE ROOM   (DELETE /:id)
============================================================ */

exports.deleteRoom = async (req, res) => {
  try {
    const vendorId = requireVendor(req, res);
    if (!vendorId) return;

    const room = await HomestayRoom.findOne({ _id: req.params.id, vendor: vendorId });
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found." });
    }

    for (const image of room.images) {
      await deleteFromCloudinary(image);
    }

    await HomestayRoom.deleteOne({ _id: room._id });

    return res.status(200).json({ success: true, message: "Room deleted successfully." });
  } catch (error) {
    console.error("Delete Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete room.", error: error.message });
  }
};

/* ============================================================
   DELETE ROOM IMAGE   (DELETE /:id/images   body: { imageUrl })
============================================================ */

exports.deleteRoomImage = async (req, res) => {
  try {
    const vendorId = requireVendor(req, res);
    if (!vendorId) return;

    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: "Image URL is required." });
    }

    const room = await HomestayRoom.findOne({ _id: req.params.id, vendor: vendorId });
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found." });
    }

    if (!room.images.includes(imageUrl)) {
      return res.status(404).json({ success: false, message: "Image does not belong to this room." });
    }

    room.images = room.images.filter((img) => img !== imageUrl);
    await room.save();
    await deleteFromCloudinary(imageUrl);

    return res.status(200).json({ success: true, message: "Room image deleted successfully.", room });
  } catch (error) {
    console.error("Delete Room Image Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete room image.", error: error.message });
  }
};

/* ============================================================
   TOGGLE ACTIVE   (PATCH /:id/toggle-status)
============================================================ */

exports.toggleRoomStatus = async (req, res) => {
  try {
    const vendorId = requireVendor(req, res);
    if (!vendorId) return;

    const room = await HomestayRoom.findOne({ _id: req.params.id, vendor: vendorId });
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found." });
    }

    room.isActive = !room.isActive;
    await room.save();

    return res.status(200).json({
      success: true,
      message: room.isActive ? "Room activated." : "Room deactivated.",
      isActive: room.isActive,
    });
  } catch (error) {
    console.error("Toggle Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update room status.", error: error.message });
  }
};