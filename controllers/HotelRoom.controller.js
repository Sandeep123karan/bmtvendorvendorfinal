const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Hotel = require("../models/Hotel.model");
const HotelRoom = require("../models/HotelRoom.model");
const cloudinary = require("../config/cloudinary");

/* ============================================================
   HELPERS
============================================================ */

const getVendorId = (req) =>
  req.vendor?._id || req.vendor?.id || req.user?.vendorId;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// multipart/form-data me sab values string hoti hain
const toBool = (v) => v === true || v === "true" || v === "1" || v === 1;

const parseArr = (value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  try {
    const p = JSON.parse(value);
    return Array.isArray(p) ? p : [p];
  } catch {
    return String(value).split(",").map((x) => x.trim()).filter(Boolean);
  }
};

const STRING_FIELDS = [
  "roomName", "roomType", "description", "shortDescription", "floorNumber",
  "roomSizeUnit", "viewType", "bedType", "bathroomType", "mealPlan",
  "pricingMode", "cancellationPolicy", "coverImage",
];

const NUMBER_FIELDS = [
  "roomSize", "maxGuests", "maxAdults", "maxChildren", "extraGuestCharge",
  "bedCount", "extraBedCharge", "bathroomCount", "mealPrice", "basePrice",
  "weekendPrice", "holidayPrice", "offerPrice", "taxPercentage",
  "serviceChargePercentage", "cancellationDeadlineHours", "minimumStay",
  "maximumStay", "displayOrder",
];

const BOOLEAN_FIELDS = [
  "extraGuestAllowed", "extraBedAvailable",
  "wifi", "airConditioning", "heater", "television", "smartTv", "minibar",
  "refrigerator", "wardrobe", "workDesk", "sofa", "balcony", "terrace",
  "kitchen", "kitchenette", "washingMachine", "iron", "roomService",
  "bathtub", "shower", "hotWater", "toiletries", "hairDryer",
  "breakfastIncluded", "lunchIncluded", "dinnerIncluded",
  "refundable", "freeCancellation", "instantBooking", "bookingConfirmationRequired",
  "coupleFriendly", "unmarriedCouplesAllowed", "localIdAllowed", "childrenAllowed",
  "petsAllowed", "smokingAllowed", "alcoholAllowed", "partiesAllowed",
  "eventsAllowed", "featured",
];

const ARRAY_FIELDS = ["amenities", "houseRules"];

/* body se sirf wahi fields nikalta hai jo aaye hain (type convert karke) */
const pickFields = (body) => {
  const out = {};

  STRING_FIELDS.forEach((f) => {
    if (body[f] !== undefined) out[f] = typeof body[f] === "string" ? body[f].trim() : body[f];
  });

  NUMBER_FIELDS.forEach((f) => {
    if (body[f] !== undefined && body[f] !== "") {
      const n = Number(body[f]);
      if (!Number.isNaN(n)) out[f] = n;
    }
  });

  BOOLEAN_FIELDS.forEach((f) => {
    if (body[f] !== undefined) out[f] = toBool(body[f]);
  });

  ARRAY_FIELDS.forEach((f) => {
    if (body[f] !== undefined) out[f] = parseArr(body[f]);
  });

  // enum fields me empty string na jaye
  ["roomType", "viewType", "bedType", "bathroomType", "mealPlan", "pricingMode", "roomSizeUnit"]
    .forEach((f) => { if (out[f] === "") delete out[f]; });

  return out;
};

/* Cloudinary upload (memoryStorage ya diskStorage dono) */
const uploadFile = (file, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (err, result) => {
        if (err) return reject(err);
        if (!result?.secure_url) return reject(new Error("Cloudinary upload failed"));
        resolve(result.secure_url);
      }
    );

    if (file.buffer) return stream.end(file.buffer);
    if (file.path) {
      const rs = fs.createReadStream(path.resolve(file.path));
      rs.on("error", reject);
      return rs.pipe(stream);
    }
    reject(new Error("Uploaded file has neither buffer nor path"));
  });

const uploadMany = async (files = [], folder) => {
  const urls = [];
  for (const f of files) urls.push(await uploadFile(f, folder));
  return urls;
};

// upload.fields([{name:"images"}]) => req.files.images ; upload.array => req.files
const getUploadedImages = (req) =>
  Array.isArray(req.files) ? req.files : req.files?.images || [];

const authFail = (res) =>
  res.status(401).json({ success: false, message: "Vendor authentication required." });

/* ============================================================
   CREATE ROOM   POST /api/hotel-rooms
============================================================ */

exports.createRoom = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { hotelId } = req.body;
    const data = pickFields(req.body);

    if (!hotelId || !isValidObjectId(hotelId))
      return res.status(400).json({ success: false, message: "Valid hotel ID is required." });

    if (!data.roomName)
      return res.status(400).json({ success: false, message: "Room name is required." });

    if (!data.roomType)
      return res.status(400).json({ success: false, message: "Room type is required." });

    const totalRooms = Number(req.body.totalRooms);
    if (!totalRooms || totalRooms < 1)
      return res.status(400).json({ success: false, message: "Total rooms must be at least 1." });

    if (!data.maxGuests || data.maxGuests < 1)
      return res.status(400).json({ success: false, message: "Maximum guests must be at least 1." });

    if (data.basePrice === undefined || data.basePrice < 0)
      return res.status(400).json({ success: false, message: "Base price is required." });

    const hotel = await Hotel.findOne({ _id: hotelId, vendor: vendorId });
    if (!hotel)
      return res.status(404).json({
        success: false,
        message: "Hotel not found or you are not authorized to manage this hotel.",
      });

    const exists = await HotelRoom.findOne({ hotel: hotelId, vendor: vendorId, roomName: data.roomName });
    if (exists)
      return res.status(409).json({
        success: false,
        message: "A room with this name already exists in this hotel.",
      });

    // images
    const files = getUploadedImages(req);
    if (files.length > 10)
      return res.status(400).json({ success: false, message: "Maximum 10 images per room." });

    const uploaded = await uploadMany(files, "hotels/room-gallery");
    const images = [...parseArr(req.body.images).filter((u) => typeof u === "string" && u), ...uploaded];

    const room = new HotelRoom({
      ...data,
      hotel: hotelId,
      vendor: vendorId,
      totalRooms,
      availableRooms: totalRooms,
      bookedRooms: 0,
      blockedRooms: 0,
      images,
      coverImage: data.coverImage || images[0] || "",
      status: "PENDING",
      isActive: true,
    });

    await room.save();

    return res.status(201).json({
      success: true,
      message: "Hotel room created successfully.",
      room,
    });
  } catch (error) {
    console.error("Create Hotel Room Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create hotel room.",
    });
  }
};

/* ============================================================
   GET ROOMS OF HOTEL   GET /api/hotel-rooms/hotel/:hotelId
============================================================ */

exports.getHotelRooms = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { hotelId } = req.params;

    if (!vendorId) return authFail(res);
    if (!isValidObjectId(hotelId))
      return res.status(400).json({ success: false, message: "Invalid hotel ID." });

    const hotel = await Hotel.findOne({ _id: hotelId, vendor: vendorId });
    if (!hotel)
      return res.status(404).json({ success: false, message: "Hotel not found or unauthorized." });

    const rooms = await HotelRoom.find({ hotel: hotelId, vendor: vendorId })
      .sort({ displayOrder: 1, createdAt: -1 });

    return res.status(200).json({ success: true, count: rooms.length, rooms });
  } catch (error) {
    console.error("Get Hotel Rooms Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch hotel rooms.", error: error.message });
  }
};

/* ============================================================
   GET SINGLE ROOM   GET /api/hotel-rooms/:roomId
============================================================ */

exports.getRoomById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { roomId } = req.params;

    if (!vendorId) return authFail(res);
    if (!isValidObjectId(roomId))
      return res.status(400).json({ success: false, message: "Invalid room ID." });

    const room = await HotelRoom.findOne({ _id: roomId, vendor: vendorId })
      .populate("hotel", "hotelName city state starRating status");

    if (!room)
      return res.status(404).json({ success: false, message: "Hotel room not found." });

    return res.status(200).json({ success: true, room });
  } catch (error) {
    console.error("Get Hotel Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch hotel room.", error: error.message });
  }
};

/* ============================================================
   UPDATE ROOM   PUT /api/hotel-rooms/:roomId
============================================================ */

exports.updateRoom = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { roomId } = req.params;

    if (!vendorId) return authFail(res);
    if (!isValidObjectId(roomId))
      return res.status(400).json({ success: false, message: "Invalid room ID." });

    const room = await HotelRoom.findOne({ _id: roomId, vendor: vendorId });
    if (!room)
      return res.status(404).json({ success: false, message: "Hotel room not found." });

    const data = pickFields(req.body);

    // duplicate name check
    if (data.roomName && data.roomName !== room.roomName) {
      const dup = await HotelRoom.findOne({
        hotel: room.hotel, vendor: vendorId, roomName: data.roomName, _id: { $ne: room._id },
      });
      if (dup)
        return res.status(409).json({ success: false, message: "A room with this name already exists in this hotel." });
    }

    Object.entries(data).forEach(([k, v]) => { room[k] = v; });

    // inventory safety
    if (req.body.totalRooms !== undefined && req.body.totalRooms !== "") {
      const newTotal = Number(req.body.totalRooms);
      if (!newTotal || newTotal < 1)
        return res.status(400).json({ success: false, message: "Total rooms must be at least 1." });

      const occupied = room.bookedRooms + room.blockedRooms;
      if (newTotal < occupied)
        return res.status(400).json({ success: false, message: "Total rooms cannot be less than booked + blocked rooms." });

      room.totalRooms = newTotal;
      room.availableRooms = Math.max(newTotal - occupied, 0);
    }

    // new images
    const files = getUploadedImages(req);
    if (files.length) {
      if (room.images.length + files.length > 10)
        return res.status(400).json({ success: false, message: "Maximum 10 images per room." });
      const uploaded = await uploadMany(files, "hotels/room-gallery");
      room.images.push(...uploaded);
    }
    if (!room.coverImage && room.images.length) room.coverImage = room.images[0];

    await room.save();

    return res.status(200).json({ success: true, message: "Hotel room updated successfully.", room });
  } catch (error) {
    console.error("Update Hotel Room Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update hotel room." });
  }
};

/* ============================================================
   DELETE ROOM   DELETE /api/hotel-rooms/:roomId
============================================================ */

exports.deleteRoom = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { roomId } = req.params;

    if (!vendorId) return authFail(res);
    if (!isValidObjectId(roomId))
      return res.status(400).json({ success: false, message: "Invalid room ID." });

    const room = await HotelRoom.findOne({ _id: roomId, vendor: vendorId });
    if (!room)
      return res.status(404).json({ success: false, message: "Hotel room not found." });

    if (room.bookedRooms > 0)
      return res.status(400).json({ success: false, message: "Room cannot be deleted while bookings are active." });

    await HotelRoom.deleteOne({ _id: roomId });

    return res.status(200).json({ success: true, message: "Hotel room deleted successfully." });
  } catch (error) {
    console.error("Delete Hotel Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete hotel room.", error: error.message });
  }
};

/* ============================================================
   UPDATE STATUS   PUT /api/hotel-rooms/:roomId/status
============================================================ */

exports.updateRoomStatus = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { roomId } = req.params;
    const { status } = req.body;

    if (!vendorId) return authFail(res);
    if (!isValidObjectId(roomId))
      return res.status(400).json({ success: false, message: "Invalid room ID." });

    const allowed = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "ACTIVE", "INACTIVE"];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowed.join(", ")}` });

    const room = await HotelRoom.findOneAndUpdate(
      { _id: roomId, vendor: vendorId },
      { status, isActive: status === "ACTIVE" },
      { new: true, runValidators: true }
    );

    if (!room)
      return res.status(404).json({ success: false, message: "Hotel room not found." });

    return res.status(200).json({ success: true, message: "Room status updated successfully.", room });
  } catch (error) {
    console.error("Update Room Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update room status.", error: error.message });
  }
};

/* ============================================================
   UPDATE INVENTORY   PUT /api/hotel-rooms/:roomId/inventory
============================================================ */

exports.updateRoomInventory = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { roomId } = req.params;
    const { bookedRooms, blockedRooms } = req.body;

    if (!vendorId) return authFail(res);
    if (!isValidObjectId(roomId))
      return res.status(400).json({ success: false, message: "Invalid room ID." });

    const room = await HotelRoom.findOne({ _id: roomId, vendor: vendorId });
    if (!room)
      return res.status(404).json({ success: false, message: "Hotel room not found." });

    if (bookedRooms !== undefined) room.bookedRooms = Number(bookedRooms);
    if (blockedRooms !== undefined) room.blockedRooms = Number(blockedRooms);

    if (room.bookedRooms < 0 || room.blockedRooms < 0)
      return res.status(400).json({ success: false, message: "Booked and blocked rooms cannot be negative." });

    const occupied = room.bookedRooms + room.blockedRooms;
    if (occupied > room.totalRooms)
      return res.status(400).json({ success: false, message: "Booked + blocked rooms cannot exceed total rooms." });

    room.availableRooms = room.totalRooms - occupied;
    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room inventory updated successfully.",
      inventory: {
        totalRooms: room.totalRooms,
        bookedRooms: room.bookedRooms,
        blockedRooms: room.blockedRooms,
        availableRooms: room.availableRooms,
      },
      room,
    });
  } catch (error) {
    console.error("Update Room Inventory Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update room inventory.", error: error.message });
  }
};

/* ============================================================
   DELETE ROOM IMAGE   PUT /api/hotel-rooms/:roomId/images/delete
============================================================ */

exports.deleteRoomImage = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { roomId } = req.params;
    const { imageUrl } = req.body;

    if (!vendorId) return authFail(res);
    if (!imageUrl)
      return res.status(400).json({ success: false, message: "Image URL is required." });

    const room = await HotelRoom.findOne({ _id: roomId, vendor: vendorId });
    if (!room)
      return res.status(404).json({ success: false, message: "Hotel room not found." });

    room.images = room.images.filter((img) => img !== imageUrl);
    if (room.coverImage === imageUrl) room.coverImage = room.images[0] || "";

    await room.save();

    return res.status(200).json({ success: true, message: "Room image deleted successfully.", room });
  } catch (error) {
    console.error("Delete Room Image Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete room image.", error: error.message });
  }
};