// controllers/HotelInventory.controller.js

const mongoose = require("mongoose");

const Hotel = require("../models/Hotel.model");
const HotelRoom = require("../models/HotelRoom.model");
const HotelInventory = require("../models/HotelInventory.model");

/* NOTE: path ka case apni asli file se match karo (Linux case-sensitive hai) */
const {
  normalizeDate,
  label,
  dateRange,
  roomInventoryDefaults,
} = require("../utils/Hotelinventory.helper");

/* ============================================================
   HELPERS
============================================================ */

const getVendorId = (req) =>
  req.vendor?._id || req.vendor?.id || req.user?.vendorId || req.user?._id;

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

const toBool = (v) => v === true || v === "true" || v === "1" || v === 1;

const bad = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};

const authFail = (res) =>
  res.status(401).json({ success: false, message: "Vendor authentication required." });

const sendError = (res, error, fallback) => {
  if (!error.status) console.error("HOTEL INVENTORY ERROR:", error);
  return res.status(error.status || 500).json({
    success: false,
    message: error.message || fallback,
  });
};

const NUMBER_FIELDS = [
  "totalRooms",
  "blockedRooms",
  "basePrice",
  "offerPrice",
  "weekendPrice",
  "holidayPrice",
  "extraGuestCharge",
  "taxPercentage",
  "serviceChargePercentage",
  "minimumStay",
  "maximumStay",
  "cancellationDeadlineHours",
];

const BOOLEAN_FIELDS = [
  "breakfastIncluded",
  "lunchIncluded",
  "dinnerIncluded",
  "instantBooking",
  "refundable",
  "freeCancellation",
  "stopSell",
  "isBlocked",
  "closedForBooking",
  "isHoliday",
];

const MEAL_PLANS = [
  "room-only",
  "breakfast",
  "breakfast-lunch",
  "breakfast-dinner",
  "half-board",
  "full-board",
  "all-meals",
];

/* body me jo fields aayi hain wahi doc par lagti hain (partial update) */
const applyFields = (doc, body) => {
  NUMBER_FIELDS.forEach((f) => {
    if (body[f] === undefined || body[f] === "" || body[f] === null) return;
    const n = Number(body[f]);
    if (!Number.isFinite(n) || n < 0) bad(`${f} must be a valid number (0 or more).`);
    doc[f] = n;
  });

  BOOLEAN_FIELDS.forEach((f) => {
    if (body[f] !== undefined) doc[f] = toBool(body[f]);
  });

  if (body.mealPlan !== undefined && body.mealPlan !== "") {
    if (!MEAL_PLANS.includes(body.mealPlan)) bad("Invalid meal plan.");
    doc.mealPlan = body.mealPlan;
  }

  if (body.cancellationPolicy !== undefined) doc.cancellationPolicy = String(body.cancellationPolicy);
  if (body.stopSellReason !== undefined) doc.stopSellReason = String(body.stopSellReason).slice(0, 200);
  if (body.blockReason !== undefined) doc.blockReason = String(body.blockReason).slice(0, 200);

  if (!doc.stopSell) doc.stopSellReason = "";
  if (!doc.isBlocked) doc.blockReason = "";
};

/* Rules check (create + update dono me) */
const validateDoc = (inv) => {
  const occupied = Number(inv.bookedRooms || 0) + Number(inv.blockedRooms || 0);
  if (inv.totalRooms < occupied) {
    bad(`Total rooms (${inv.totalRooms}) cannot be less than booked + blocked (${occupied}).`);
  }
  if (inv.taxPercentage > 100 || inv.serviceChargePercentage > 100) {
    bad("Percentage cannot be more than 100.");
  }
  if (inv.minimumStay > inv.maximumStay) {
    bad("Minimum stay cannot be more than maximum stay.");
  }
};

/* Frontend ko dikhane ke liye: is date par kaun si price lagegi
   (booking ke nightlyRate jaisa: offer > holiday > weekend(Fri/Sat) > base) */
const withRate = (doc) => {
  const inv = doc.toObject ? doc.toObject() : doc;
  const day = new Date(inv.date).getUTCDay();
  const weekend = day === 5 || day === 6;

  let appliedPrice = Number(inv.basePrice) || 0;
  if (inv.isHoliday && Number(inv.holidayPrice) > 0) appliedPrice = Number(inv.holidayPrice);
  else if (weekend && Number(inv.weekendPrice) > 0) appliedPrice = Number(inv.weekendPrice);

  const finalPrice = Number(inv.offerPrice) > 0 ? Number(inv.offerPrice) : appliedPrice;

  return {
    ...inv,
    dayType: inv.isHoliday ? "holiday" : weekend ? "weekend" : "weekday",
    appliedPrice,
    finalPrice,
  };
};

/* Hotel + room vendor ke hain ya nahi */
const loadOwned = async (vendorId, hotelId, roomId) => {
  if (!hotelId || !roomId) bad("hotelId and roomId are required.");
  if (!validId(hotelId) || !validId(roomId)) bad("Invalid hotel or room ID.");

  const hotel = await Hotel.findOne({ _id: hotelId, vendor: vendorId });
  if (!hotel) bad("Hotel not found or unauthorized.", 404);

  const room = await HotelRoom.findOne({ _id: roomId, hotel: hotelId, vendor: vendorId });
  if (!room) bad("Room not found or unauthorized.", 404);

  return { hotel, room };
};

/* Ek date ka record banao/update karo (race me duplicate key aaye to ek baar retry) */
const saveDay = async ({ room, hotelId, vendorId, date, body }) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let inv = await HotelInventory.findOne({ room: room._id, date });

    if (!inv) {
      inv = new HotelInventory({
        ...roomInventoryDefaults(room),
        hotel: hotelId,
        room: room._id,
        vendor: vendorId,
        date,
      });
    }

    applyFields(inv, body);
    validateDoc(inv);

    inv.isActive = true;
    inv.lastUpdatedBy = vendorId;

    try {
      await inv.save(); // pre-save: availableRooms + status
      return inv;
    } catch (err) {
      if (err.code === 11000 && attempt === 0) continue;
      throw err;
    }
  }
  return null;
};

/* Single + range dono yahi use karte hain */
const writeDates = async (req, res, startInput, endInput) => {
  const vendorId = getVendorId(req);
  if (!vendorId) return authFail(res);

  const { hotelId, roomId } = req.body;
  const { room } = await loadOwned(vendorId, hotelId, roomId);

  const start = normalizeDate(startInput);
  const end = endInput ? normalizeDate(endInput) : start;

  if (!start || !end) bad("Invalid date.");
  if (end < start) bad("End date must be on or after start date.");

  const dates = dateRange(start, end);
  if (dates.length > 366) bad("Maximum 366 days can be updated at once.");

  let saved = 0;
  let last = null;
  const skipped = [];

  for (const d of dates) {
    try {
      last = await saveDay({ room, hotelId, vendorId, date: d, body: req.body });
      saved += 1;
    } catch (err) {
      if (err.status === 400 || err.name === "ValidationError") {
        skipped.push({ date: label(d), reason: err.message });
      } else {
        throw err;
      }
    }
  }

  if (saved === 0) {
    return res.status(400).json({
      success: false,
      message: skipped[0]?.reason || "Nothing was saved.",
      skipped,
    });
  }

  return res.status(200).json({
    success: true,
    message: saved === 1 ? "Inventory saved successfully." : `Inventory saved for ${saved} date(s).`,
    count: saved,
    skipped,
    inventory: last ? withRate(last) : null,
  });
};

/* ============================================================
   CREATE (single date)  POST /api/hotel-inventory
   body: hotelId, roomId, date, + fields
============================================================ */
exports.createInventory = async (req, res) => {
  try {
    if (!req.body.date) bad("date is required.");
    return await writeDates(req, res, req.body.date, null);
  } catch (error) {
    return sendError(res, error, "Failed to save hotel inventory.");
  }
};

/* ============================================================
   CREATE RANGE  POST /api/hotel-inventory/range
   body: hotelId, roomId, startDate, endDate, + fields
============================================================ */
exports.createInventoryRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) bad("startDate and endDate are required.");
    return await writeDates(req, res, startDate, endDate);
  } catch (error) {
    return sendError(res, error, "Failed to save hotel inventory.");
  }
};

/* ============================================================
   UPSERT (purana)  PUT /api/hotel-inventory
   body: hotelId, roomId, date, endDate(optional), + fields
============================================================ */
exports.upsertInventory = async (req, res) => {
  try {
    if (!req.body.date) bad("date is required.");
    return await writeDates(req, res, req.body.date, req.body.endDate);
  } catch (error) {
    return sendError(res, error, "Failed to save hotel inventory.");
  }
};

/* ============================================================
   LIST  GET /api/hotel-inventory
   ?hotelId=&roomId=&startDate=&endDate=&page=&limit=
============================================================ */
exports.getInventory = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { hotelId, roomId, startDate, endDate, page = 1, limit = 31 } = req.query;

    const query = { vendor: vendorId };

    if (hotelId) {
      if (!validId(hotelId)) bad("Invalid hotel ID.");
      query.hotel = hotelId;
    }
    if (roomId) {
      if (!validId(roomId)) bad("Invalid room ID.");
      query.room = roomId;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const s = normalizeDate(startDate);
        if (!s) bad("Invalid startDate.");
        query.date.$gte = s;
      }
      if (endDate) {
        const e = normalizeDate(endDate);
        if (!e) bad("Invalid endDate.");
        query.date.$lte = e;
      }
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 31, 1), 100);

    const [rows, total] = await Promise.all([
      HotelInventory.find(query)
        .populate("hotel", "hotelName city")
        .populate("room", "roomName roomType totalRooms")
        .sort({ date: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      HotelInventory.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: rows.length,
      inventory: rows.map(withRate),
      pagination: { total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (error) {
    return sendError(res, error, "Failed to fetch inventory.");
  }
};

/* ============================================================
   ROOM CALENDAR (purana)  GET /api/hotel-inventory/room/:roomId?from=&to=
============================================================ */
exports.getRoomInventory = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { roomId } = req.params;
    const { from, to } = req.query;

    if (!validId(roomId)) bad("Invalid room ID.");

    const query = { room: roomId, vendor: vendorId };

    if (from || to) {
      query.date = {};
      if (from) {
        const f = normalizeDate(from);
        if (!f) bad("Invalid 'from' date.");
        query.date.$gte = f;
      }
      if (to) {
        const t = normalizeDate(to);
        if (!t) bad("Invalid 'to' date.");
        query.date.$lte = t;
      }
    }

    const inventory = await HotelInventory.find(query).sort({ date: 1 }).limit(400);

    return res.status(200).json({ success: true, count: inventory.length, inventory: inventory.map(withRate) });
  } catch (error) {
    return sendError(res, error, "Failed to fetch inventory.");
  }
};

/* ============================================================
   SINGLE  GET /api/hotel-inventory/:inventoryId
============================================================ */
exports.getSingleInventory = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { inventoryId } = req.params;
    if (!validId(inventoryId)) bad("Invalid inventory ID.");

    const inv = await HotelInventory.findOne({ _id: inventoryId, vendor: vendorId })
      .populate("hotel", "hotelName city")
      .populate("room", "roomName roomType totalRooms");

    if (!inv) bad("Inventory not found.", 404);

    return res.status(200).json({ success: true, inventory: withRate(inv) });
  } catch (error) {
    return sendError(res, error, "Failed to fetch inventory.");
  }
};

/* ============================================================
   UPDATE  PUT /api/hotel-inventory/:inventoryId
   (date, hotel, room change nahi hote; bookedRooms kabhi nahi badalta)
============================================================ */
exports.updateInventory = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { inventoryId } = req.params;
    if (!validId(inventoryId)) bad("Invalid inventory ID.");

    const inv = await HotelInventory.findOne({ _id: inventoryId, vendor: vendorId });
    if (!inv) bad("Inventory not found.", 404);

    applyFields(inv, req.body);
    validateDoc(inv);

    inv.lastUpdatedBy = vendorId;
    await inv.save();

    const fresh = await HotelInventory.findById(inv._id)
      .populate("hotel", "hotelName city")
      .populate("room", "roomName roomType totalRooms");

    return res.status(200).json({ success: true, message: "Inventory updated successfully.", inventory: withRate(fresh) });
  } catch (error) {
    if (error.name === "ValidationError") error.status = 400;
    return sendError(res, error, "Failed to update inventory.");
  }
};

/* ============================================================
   BLOCK / UNBLOCK / STOP SELL / RESUME
============================================================ */

const patchFlags = (build, okMsg) => async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { inventoryId } = req.params;
    if (!validId(inventoryId)) bad("Invalid inventory ID.");

    const inv = await HotelInventory.findOne({ _id: inventoryId, vendor: vendorId });
    if (!inv) bad("Inventory not found.", 404);

    build(inv, req.body || {});
    inv.lastUpdatedBy = vendorId;
    await inv.save();

    return res.status(200).json({ success: true, message: okMsg(inv), inventory: withRate(inv) });
  } catch (error) {
    return sendError(res, error, "Failed to update inventory.");
  }
};

exports.blockInventory = patchFlags((inv, b) => {
  inv.isBlocked = true;
  inv.blockReason = String(b.reason || b.blockReason || "Blocked by vendor").slice(0, 200);
}, () => "Date blocked.");

exports.unblockInventory = patchFlags((inv) => {
  inv.isBlocked = false;
  inv.blockReason = "";
}, () => "Date unblocked.");

/* Naya (PATCH, body ke bina = stop) aur purana (PUT { stopSell, reason }) dono chalte hain */
exports.stopSellInventory = patchFlags((inv, b) => {
  inv.stopSell = b.stopSell === undefined ? true : toBool(b.stopSell);
  inv.stopSellReason = inv.stopSell ? String(b.reason || "").slice(0, 200) : "";
}, (inv) => (inv.stopSell ? "Room stopped for sale." : "Room opened for sale."));

exports.resumeSellInventory = patchFlags((inv) => {
  inv.stopSell = false;
  inv.stopSellReason = "";
}, () => "Sell resumed.");

/* ============================================================
   DELETE  DELETE /api/hotel-inventory/:inventoryId
   (wapas room defaults par)
============================================================ */
exports.deleteInventory = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { inventoryId } = req.params;
    if (!validId(inventoryId)) bad("Invalid inventory ID.");

    const inv = await HotelInventory.findOne({ _id: inventoryId, vendor: vendorId });
    if (!inv) bad("Inventory not found.", 404);

    if (inv.bookedRooms > 0) bad("This date has active bookings, so it cannot be deleted.");

    await HotelInventory.deleteOne({ _id: inventoryId });

    return res.status(200).json({ success: true, message: "Inventory deleted. Room defaults will apply." });
  } catch (error) {
    return sendError(res, error, "Failed to delete inventory.");
  }
};