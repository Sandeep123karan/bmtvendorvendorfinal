const mongoose = require("mongoose");

const Hostel = require("../models/Hostel.model");
const HostelRoom = require("../models/HostelRoom.model");
const HostelBed = require("../models/HostelBed.model");
const { checkFiles, uploadMultipleFiles, cleanupUploadedAssets } = require("../utils/hostelMedia");

// =====================================================
// CONSTANTS & HELPERS
// =====================================================
const ROOM_TYPES = ["Dormitory", "Private Room", "Twin Sharing", "Triple Sharing", "Family Room", "Other"];
const GENDERS = ["Male", "Female", "Unisex"];
const BATHROOMS = ["Attached", "Shared", "Not Specified"];
const BED_TYPES = ["Single", "Bunk Upper", "Bunk Lower", "Double"];
const BED_STATUS = ["AVAILABLE", "BLOCKED", "MAINTENANCE"];
const MAX_IMAGES = 10;

const getVendorId = (req) => {
  const id = req.vendor?._id || req.user?._id;
  return id && mongoose.isValidObjectId(id) ? id : null;
};
const validId = (id) => mongoose.isValidObjectId(id);

const getFiles = (req, name) => {
  if (Array.isArray(req.files)) return req.files.filter((f) => f.fieldname === name);
  if (req.files && Array.isArray(req.files[name])) return req.files[name];
  return [];
};

const parseJSON = (value, name, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { throw new Error(`${name} must be valid JSON.`); }
};

const parseAmenities = (value) => {
  const arr = parseJSON(value, "amenities", []);
  if (!Array.isArray(arr) || !arr.every((a) => typeof a === "string")) throw new Error("amenities must be an array of strings.");
  return [...new Set(arr.map((a) => a.trim()).filter(Boolean))];
};

const parseBeds = (value) => {
  const arr = parseJSON(value, "beds", null);
  if (!Array.isArray(arr) || arr.length < 1 || arr.length > 100) throw new Error("Provide between 1 and 100 beds.");

  const beds = arr.map((b) => {
    if (!b || typeof b !== "object") throw new Error("Invalid bed details.");
    const bedNumber = String(b.bedNumber || "").trim();
    const bedType = b.bedType || "Single";
    const status = b.status || "AVAILABLE";
    const pricePerNight = Number(b.pricePerNight);
    if (!bedNumber) throw new Error("Every bed requires a bed number.");
    if (!BED_TYPES.includes(bedType)) throw new Error(`Invalid bed type: ${bedType}`);
    if (!BED_STATUS.includes(status)) throw new Error(`Invalid bed status: ${status}`);
    if (!Number.isFinite(pricePerNight) || pricePerNight < 0) throw new Error(`Invalid price for bed ${bedNumber}.`);
    if (b._id && !validId(b._id)) throw new Error("Invalid bed id.");
    return { _id: b._id || null, bedNumber, bedType, status, pricePerNight };
  });

  if (new Set(beds.map((b) => b.bedNumber.toLowerCase())).size !== beds.length)
    throw new Error("Bed numbers must be unique within a room.");
  return beds;
};

// Transactions need a replica set (Atlas has one). On a local standalone MongoDB we fall back to plain writes.
const opt = (s) => (s ? { session: s } : {});
const runTx = async (fn) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => fn(session));
  } catch (err) {
    if (/replica set|Transaction numbers/i.test(err.message || "")) await fn(null);
    else throw err;
  } finally {
    await session.endSession();
  }
};

const assertNoActiveBookings = async (roomId, bedIds) => {
  const Booking = mongoose.models.HostelBooking;
  if (!Booking) return;
  const exists = await Booking.exists({
    $or: [{ roomId }, { bedId: { $in: bedIds } }],
    bookingStatus: { $in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
  });
  if (exists) {
    const e = new Error("This room has active bookings. Cancel or complete them first.");
    e.status = 409;
    throw e;
  }
};

// Validates only the fields that were sent. Creating requires the core fields.
const buildRoomData = (body, isCreate) => {
  const d = {};

  ["roomName", "roomNumber", "floor", "description"].forEach((f) => {
    if (body[f] === undefined) return;
    if (typeof body[f] !== "string") throw new Error(`${f} must be a string.`);
    d[f] = body[f].trim();
  });

  const enums = [
    ["roomType", ROOM_TYPES], ["genderPreference", GENDERS], ["bathroomType", BATHROOMS],
  ];
  enums.forEach(([f, list]) => {
    if (body[f] === undefined) return;
    if (!list.includes(body[f])) throw new Error(`Invalid ${f}.`);
    d[f] = body[f];
  });

  if (body.totalBeds !== undefined) {
    const n = Number(body.totalBeds);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error("totalBeds must be between 1 and 100.");
    d.totalBeds = n;
  }
  if (body.pricePerBed !== undefined) {
    const n = Number(body.pricePerBed);
    if (!Number.isFinite(n) || n < 0) throw new Error("Invalid pricePerBed.");
    d.pricePerBed = n;
  }
  if (body.roomSize !== undefined) {
    if (body.roomSize === "" || body.roomSize === null) d.roomSize = null;
    else {
      const n = Number(body.roomSize);
      if (!Number.isFinite(n) || n < 0) throw new Error("Invalid roomSize.");
      d.roomSize = n;
    }
  }
  if (body.amenities !== undefined) d.amenities = parseAmenities(body.amenities);

  if (isCreate) {
    ["roomName", "roomNumber", "totalBeds", "pricePerBed"].forEach((f) => {
      if (d[f] === undefined || d[f] === "") throw new Error(`${f} is required.`);
    });
  } else {
    ["roomName", "roomNumber"].forEach((f) => {
      if (d[f] !== undefined && d[f] === "") throw new Error(`${f} cannot be empty.`);
    });
  }
  return d;
};

const sendError = (res, error, fallbackMsg) => {
  const status = error.status || (error.code === 11000 ? 409 : 400);
  return res.status(status).json({
    success: false,
    message: error.code === 11000 ? "Room number or bed number already exists." : error.message || fallbackMsg,
  });
};

// =====================================================
// CREATE ROOM + BEDS
// POST /api/vendor/hostel-rooms   (multipart/form-data)
// =====================================================
exports.createHostelRoom = async (req, res) => {
  let uploaded = [];
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(401).json({ success: false, message: "Authenticated vendor not found." });

    const { hostelId } = req.body;
    if (!validId(hostelId)) return res.status(400).json({ success: false, message: "Valid hostelId is required." });

    const hostel = await Hostel.findOne({ _id: hostelId, vendorId }).select("_id");
    if (!hostel) return res.status(404).json({ success: false, message: "Hostel not found for this vendor." });

    const data = buildRoomData(req.body, true);
    const files = getFiles(req, "images");
    checkFiles(files, MAX_IMAGES, "room media files");

    const beds =
      req.body.beds !== undefined
        ? parseBeds(req.body.beds)
        : Array.from({ length: data.totalBeds }, (_, i) => ({
            bedNumber: `B${i + 1}`, bedType: "Single", status: "AVAILABLE", pricePerNight: data.pricePerBed,
          }));
    if (beds.length !== data.totalBeds) throw new Error("Bed details count must equal totalBeds.");

    uploaded = await uploadMultipleFiles(files, `bmt/hostels/${vendorId}/rooms`);

    const room = new HostelRoom({
      ...data, vendorId, hostelId, images: uploaded,
      isActive: req.body.isActive === undefined ? true : req.body.isActive === true || req.body.isActive === "true",
    });

    await runTx(async (s) => {
      await room.save(opt(s));
      await HostelBed.insertMany(
        beds.map((b) => ({
          vendorId, hostelId, roomId: room._id,
          bedNumber: b.bedNumber, bedType: b.bedType, status: b.status, pricePerNight: b.pricePerNight,
        })),
        { ...opt(s), ordered: true }
      );
    });
    uploaded = [];

    return res.status(201).json({
      success: true,
      message: "Room and beds created successfully.",
      room,
      beds: await HostelBed.find({ roomId: room._id, vendorId }).sort({ bedNumber: 1 }).lean(),
    });
  } catch (error) {
    await cleanupUploadedAssets(uploaded);
    console.error("createHostelRoom:", error);
    return sendError(res, error, "Failed to create room.");
  }
};

// =====================================================
// LIST ALL ROOMS OF THE VENDOR (all hostels)
// GET /api/vendor/hostel-rooms?hostelId=&search=&page=&limit=
// =====================================================
exports.getMyRooms = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(401).json({ success: false, message: "Authenticated vendor not found." });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const filter = { vendorId };
    if (req.query.hostelId) {
      if (!validId(req.query.hostelId)) return res.status(400).json({ success: false, message: "Invalid hostelId." });
      filter.hostelId = req.query.hostelId;
    }
    if (req.query.search) {
      const rx = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ roomName: rx }, { roomNumber: rx }, { roomType: rx }];
    }

    const [rooms, total] = await Promise.all([
      HostelRoom.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate("hostelId", "hostelName city state").lean(),
      HostelRoom.countDocuments(filter),
    ]);

    const beds = await HostelBed.find({ vendorId, roomId: { $in: rooms.map((r) => r._id) } }).lean();

    const data = rooms.map((r) => {
      const { hostelId: h, ...rest } = r;
      return {
        ...rest,
        hostelId: h?._id || null,
        hostel: h ? { _id: h._id, hostelName: h.hostelName, city: h.city, state: h.state } : null,
        beds: beds.filter((b) => String(b.roomId) === String(r._id)),
      };
    });

    return res.status(200).json({ success: true, total, page, totalPages: Math.ceil(total / limit) || 1, rooms: data });
  } catch (error) {
    console.error("getMyRooms:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch rooms." });
  }
};

// =====================================================
// ROOMS OF ONE HOSTEL
// GET /api/vendor/hostel-rooms/:hostelId
// =====================================================
exports.getHostelRooms = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { hostelId } = req.params;
    if (!vendorId || !validId(hostelId))
      return res.status(400).json({ success: false, message: "Valid vendor and hostel IDs are required." });

    const hostel = await Hostel.findOne({ _id: hostelId, vendorId }).select("_id hostelName");
    if (!hostel) return res.status(404).json({ success: false, message: "Hostel not found." });

    const rooms = await HostelRoom.find({ hostelId, vendorId }).sort({ createdAt: -1 }).lean();
    const beds = await HostelBed.find({ hostelId, vendorId, roomId: { $in: rooms.map((r) => r._id) } }).lean();

    return res.status(200).json({
      success: true,
      hostel,
      count: rooms.length,
      rooms: rooms.map((r) => ({ ...r, beds: beds.filter((b) => String(b.roomId) === String(r._id)) })),
    });
  } catch (error) {
    console.error("getHostelRooms:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch hostel rooms." });
  }
};

// =====================================================
// SINGLE ROOM
// GET /api/vendor/hostel-rooms/:hostelId/room/:roomId
// =====================================================
exports.getHostelRoomById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { hostelId, roomId } = req.params;
    if (!vendorId || !validId(hostelId) || !validId(roomId))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const room = await HostelRoom.findOne({ _id: roomId, hostelId, vendorId }).lean();
    if (!room) return res.status(404).json({ success: false, message: "Room not found." });

    const [beds, hostel] = await Promise.all([
      HostelBed.find({ roomId, vendorId }).sort({ bedNumber: 1 }).lean(),
      Hostel.findById(hostelId).select("hostelName city state").lean(),
    ]);

    return res.status(200).json({ success: true, room: { ...room, beds, hostel } });
  } catch (error) {
    console.error("getHostelRoomById:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch room." });
  }
};

// =====================================================
// UPDATE ROOM (details + images + beds)
// PUT /api/vendor/hostel-rooms/:hostelId/room/:roomId   (multipart/form-data)
//
// beds (optional JSON array): items with _id are updated, items without _id are created,
// existing beds that are missing from the array are deleted.
// =====================================================
exports.updateHostelRoom = async (req, res) => {
  let uploaded = [];
  try {
    const vendorId = getVendorId(req);
    const { hostelId, roomId } = req.params;
    if (!vendorId || !validId(hostelId) || !validId(roomId))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const room = await HostelRoom.findOne({ _id: roomId, hostelId, vendorId });
    if (!room) return res.status(404).json({ success: false, message: "Room not found." });

    const data = buildRoomData(req.body, false);
    const existingBeds = await HostelBed.find({ roomId, vendorId }).lean();

    // ---- beds
    let beds = null;
    let toDelete = [];
    if (req.body.beds !== undefined) {
      beds = parseBeds(req.body.beds);
      if (data.totalBeds !== undefined && data.totalBeds !== beds.length)
        throw new Error("totalBeds must equal the number of beds sent.");

      const existingIds = existingBeds.map((b) => String(b._id));
      if (beds.some((b) => b._id && !existingIds.includes(String(b._id))))
        throw new Error("One or more bed ids do not belong to this room.");

      const keepIds = beds.filter((b) => b._id).map((b) => String(b._id));
      toDelete = existingBeds.filter((b) => !keepIds.includes(String(b._id)));
      if (toDelete.length) await assertNoActiveBookings(roomId, toDelete.map((b) => b._id));
      data.totalBeds = beds.length;
    } else if (data.totalBeds !== undefined && data.totalBeds !== existingBeds.length) {
      throw new Error("Change the number of beds by sending the beds list.");
    }

    // ---- images
    const remove = parseJSON(req.body.removeImagePublicIds, "removeImagePublicIds", []);
    if (!Array.isArray(remove)) throw new Error("removeImagePublicIds must be an array.");
    const files = getFiles(req, "images");
    checkFiles(files, MAX_IMAGES, "room media files");

    const keepImages = room.images.filter((i) => !remove.includes(i.publicId));
    const removedImages = room.images.filter((i) => remove.includes(i.publicId));
    if (keepImages.length + files.length > MAX_IMAGES) throw new Error(`Maximum ${MAX_IMAGES} room media files are allowed.`);

    uploaded = await uploadMultipleFiles(files, `bmt/hostels/${vendorId}/rooms`);

    Object.assign(room, data);
    if (req.body.isActive !== undefined) room.isActive = req.body.isActive === true || req.body.isActive === "true";
    room.images = [...keepImages, ...uploaded];

    await runTx(async (s) => {
      await room.save(opt(s));
      if (!beds) return;

      if (toDelete.length) await HostelBed.deleteMany({ _id: { $in: toDelete.map((b) => b._id) }, roomId, vendorId }, opt(s));

      for (const b of beds.filter((x) => x._id)) {
        await HostelBed.updateOne(
          { _id: b._id, roomId, vendorId },
          { $set: { bedNumber: b.bedNumber, bedType: b.bedType, status: b.status, pricePerNight: b.pricePerNight } },
          opt(s)
        );
      }
      const fresh = beds.filter((x) => !x._id);
      if (fresh.length) {
        await HostelBed.insertMany(
          fresh.map((b) => ({
            vendorId, hostelId, roomId,
            bedNumber: b.bedNumber, bedType: b.bedType, status: b.status, pricePerNight: b.pricePerNight,
          })),
          { ...opt(s), ordered: true }
        );
      }
    });

    uploaded = [];
    await cleanupUploadedAssets(removedImages);

    return res.status(200).json({
      success: true,
      message: "Room updated successfully.",
      room,
      beds: await HostelBed.find({ roomId, vendorId }).sort({ bedNumber: 1 }).lean(),
    });
  } catch (error) {
    await cleanupUploadedAssets(uploaded);
    console.error("updateHostelRoom:", error);
    return sendError(res, error, "Failed to update room.");
  }
};

// =====================================================
// DELETE ROOM + BEDS + IMAGES
// DELETE /api/vendor/hostel-rooms/:hostelId/room/:roomId
// =====================================================
exports.deleteHostelRoom = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { hostelId, roomId } = req.params;
    if (!vendorId || !validId(hostelId) || !validId(roomId))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const room = await HostelRoom.findOne({ _id: roomId, hostelId, vendorId });
    if (!room) return res.status(404).json({ success: false, message: "Room not found." });

    const beds = await HostelBed.find({ roomId, vendorId }).select("_id").lean();
    await assertNoActiveBookings(roomId, beds.map((b) => b._id));

    const images = [...room.images];

    await runTx(async (s) => {
      await HostelBed.deleteMany({ roomId, vendorId }, opt(s));
      await HostelRoom.deleteOne({ _id: roomId, vendorId }, opt(s));
    });

    await cleanupUploadedAssets(images);

    return res.status(200).json({ success: true, message: "Room and its beds deleted successfully." });
  } catch (error) {
    console.error("deleteHostelRoom:", error);
    return res.status(error.status || 500).json({ success: false, message: error.message || "Failed to delete room." });
  }
};