const crypto = require("crypto");
const mongoose = require("mongoose");

const Resort = require("../models/Resort.model");
const ResortRoom = require("../models/ResortRoom.model");
const ResortRoomUnit = require("../models/ResortRoomUnit.model");
const ResortInventory = require("../models/ResortInventory.model");
const ResortRatePlan = require("../models/ResortRatePlan.model");
const ResortPricing = require("../models/ResortPricing.model");
const ResortBooking = require("../models/ResortBooking.model");

/* ==========================================================
                    CONSTANTS
========================================================== */

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"];

const STATUS_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const PAYMENT_METHODS = ["ONLINE", "CASH", "CARD", "UPI", "BANK_TRANSFER"];

/* ==========================================================
                    HELPERS
========================================================== */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* Always normalise to UTC midnight so dates match inventory/pricing */
const toUTCDate = (value) => {
  if (!value) return null;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return null;

  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
};

const dateKey = (d) => new Date(d).toISOString().split("T")[0];

const getStayDates = (checkIn, checkOut) => {
  const dates = [];
  const current = new Date(checkIn);

  while (current < checkOut) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const generateBookingId = () =>
  `RES${Date.now().toString(36).toUpperCase()}${crypto
    .randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;

const sendError = (res, error, label) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  if (error && error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error && error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID or value supplied.",
    });
  }

  console.error(`${label}:`, error);

  return res.status(500).json({
    success: false,
    message: error.message || "Something went wrong.",
  });
};

const populateBooking = (query) =>
  query
    .populate("resort", "name address.city address.state")
    .populate("roomCategory", "name maxAdults maxChildren")
    .populate("ratePlan", "displayName name mealPlan refundable")
    .populate("roomUnit", "roomNumber floor building status");

const derivePaymentStatus = (paid, total, current) => {
  if (current === "REFUNDED" || current === "FAILED") {
    if (paid <= 0) return current;
  }

  if (paid <= 0) return "PENDING";
  if (paid + 0.009 >= total) return "PAID";
  return "PARTIAL";
};

const validateGuest = (guest, label) => {
  if (!guest || !String(guest.name || "").trim() || !String(guest.phone || "").trim()) {
    throw new HttpError(400, `${label} name and phone are required.`);
  }
};

const cleanGuest = (guest) => ({
  name: String(guest.name || "").trim(),
  email: String(guest.email || "").trim().toLowerCase(),
  phone: String(guest.phone || "").trim(),
  age:
    guest.age === undefined || guest.age === null || guest.age === ""
      ? null
      : Number(guest.age),
  gender: ["MALE", "FEMALE", "OTHER"].includes(guest.gender)
    ? guest.gender
    : "OTHER",
});

/* ==========================================================
                    INVENTORY (ATOMIC)
========================================================== */

const availableExpr = {
  $max: [
    0,
    {
      $subtract: [
        "$totalRooms",
        { $add: ["$bookedRooms", "$blockedRooms", "$maintenanceRooms"] },
      ],
    },
  ],
};

/* Reserve rooms for one date. Returns null when not enough rooms. */
const reserveOneDate = (ctx, date, rooms) =>
  ResortInventory.findOneAndUpdate(
    {
      vendor: ctx.vendor,
      resort: ctx.resort,
      roomCategory: ctx.roomCategory,
      date,
      status: "AVAILABLE",
      availableRooms: { $gte: rooms },
    },
    [
      { $set: { bookedRooms: { $add: ["$bookedRooms", rooms] } } },
      { $set: { availableRooms: availableExpr } },
      {
        $set: {
          status: {
            $cond: [{ $lte: ["$availableRooms", 0] }, "SOLD_OUT", "$status"],
          },
        },
      },
    ],
    { new: true, updatePipeline: true }
  );

/* Release rooms for one date */
const releaseOneDate = (ctx, date, rooms) =>
  ResortInventory.findOneAndUpdate(
    {
      vendor: ctx.vendor,
      resort: ctx.resort,
      roomCategory: ctx.roomCategory,
      date,
    },
    [
      {
        $set: {
          bookedRooms: { $max: [0, { $subtract: ["$bookedRooms", rooms] }] },
        },
      },
      { $set: { availableRooms: availableExpr } },
      {
        $set: {
          status: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "SOLD_OUT"] },
                  { $gt: ["$availableRooms", 0] },
                ],
              },
              "AVAILABLE",
              "$status",
            ],
          },
        },
      },
    ],
    { new: true, updatePipeline: true }
  );

const releaseDates = async (ctx, dates, rooms) => {
  for (const date of dates) {
    await releaseOneDate(ctx, date, rooms);
  }
};

const reserveDates = async (ctx, dates, rooms) => {
  const reserved = [];

  for (const date of dates) {
    const updated = await reserveOneDate(ctx, date, rooms);

    if (!updated) {
      // Roll back whatever was already reserved
      try {
        await releaseDates(ctx, reserved, rooms);
      } catch (rollbackError) {
        console.error("Inventory rollback failed:", rollbackError);
      }

      throw new HttpError(
        409,
        `Rooms are no longer available for ${dateKey(date)}. Please refresh and try again.`
      );
    }

    reserved.push(date);
  }

  return reserved;
};

const releaseBookingInventory = async (booking) => {
  const dates = getStayDates(booking.checkIn, booking.checkOut);

  await releaseDates(
    {
      vendor: booking.vendor,
      resort: booking.resort,
      roomCategory: booking.roomCategory,
    },
    dates,
    booking.rooms
  );
};

/* ==========================================================
                    STAY VALIDATION + PRICING
========================================================== */

const prepareStay = async (vendorId, body) => {
  const {
    resortId,
    roomCategoryId,
    ratePlanId,
    checkIn,
    checkOut,
    rooms = 1,
    adults,
    children = 0,
    discountAmount = 0,
  } = body;

  if (
    !resortId ||
    !roomCategoryId ||
    !ratePlanId ||
    !checkIn ||
    !checkOut ||
    !adults
  ) {
    throw new HttpError(400, "Required booking fields are missing.");
  }

  if (!isId(resortId) || !isId(roomCategoryId) || !isId(ratePlanId)) {
    throw new HttpError(400, "Invalid resort, room or rate plan ID.");
  }

  const safeRooms = Number(rooms);
  const safeAdults = Number(adults);
  const safeChildren = Number(children);
  const safeDiscount = Number(discountAmount) || 0;

  if (!Number.isInteger(safeRooms) || safeRooms < 1) {
    throw new HttpError(400, "Rooms must be a whole number of at least 1.");
  }

  if (!Number.isInteger(safeAdults) || safeAdults < 1) {
    throw new HttpError(400, "At least 1 adult is required.");
  }

  if (!Number.isInteger(safeChildren) || safeChildren < 0) {
    throw new HttpError(400, "Children must be 0 or more.");
  }

  if (safeDiscount < 0) {
    throw new HttpError(400, "Discount cannot be negative.");
  }

  const checkInDate = toUTCDate(checkIn);
  const checkOutDate = toUTCDate(checkOut);

  if (!checkInDate || !checkOutDate) {
    throw new HttpError(400, "Invalid check-in or check-out date.");
  }

  if (checkOutDate <= checkInDate) {
    throw new HttpError(400, "Check-out must be after check-in.");
  }

  const totalNights = Math.round(
    (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
  );

  /* ---------- resort ---------- */
  const resort = await Resort.findOne({ _id: resortId, vendor: vendorId });

  if (!resort) {
    throw new HttpError(404, "Resort not found or access denied.");
  }

  /* ---------- room category ---------- */
  const roomCategory = await ResortRoom.findOne({
    _id: roomCategoryId,
    resort: resortId,
    vendor: vendorId,
  });

  if (!roomCategory) {
    throw new HttpError(404, "Room category not found.");
  }

  /* ---------- rate plan ---------- */
  const ratePlan = await ResortRatePlan.findOne({
    _id: ratePlanId,
    resort: resortId,
    roomCategory: roomCategoryId,
    vendor: vendorId,
    isActive: true,
  });

  if (!ratePlan) {
    throw new HttpError(404, "Rate plan not found or inactive.");
  }

  /* ---------- min / max stay ---------- */
  if (totalNights < ratePlan.minStay) {
    throw new HttpError(400, `Minimum stay is ${ratePlan.minStay} night(s).`);
  }

  if (totalNights > ratePlan.maxStay) {
    throw new HttpError(400, `Maximum stay is ${ratePlan.maxStay} night(s).`);
  }

  /* ---------- inventory ---------- */
  const stayDates = getStayDates(checkInDate, checkOutDate);

  const inventories = await ResortInventory.find({
    resort: resortId,
    roomCategory: roomCategoryId,
    vendor: vendorId,
    date: { $gte: checkInDate, $lt: checkOutDate },
  });

  if (inventories.length !== stayDates.length) {
    throw new HttpError(
      400,
      "Inventory is not configured for one or more selected dates."
    );
  }

  let minAvailable = Infinity;

  for (const inventory of inventories) {
    if (inventory.status !== "AVAILABLE" || inventory.availableRooms < safeRooms) {
      throw new HttpError(
        400,
        `Room is not available for ${dateKey(inventory.date)}.`
      );
    }

    minAvailable = Math.min(minAvailable, inventory.availableRooms);
  }

  /* ---------- date-wise pricing ---------- */
  const datePrices = await ResortPricing.find({
    ratePlan: ratePlanId,
    date: { $gte: checkInDate, $lt: checkOutDate },
  });

  const pricingMap = new Map();

  datePrices.forEach((item) => {
    pricingMap.set(dateKey(item.date), item);
  });

  let roomPrice = 0;
  const nightly = [];

  for (const stayDate of stayDates) {
    const key = dateKey(stayDate);
    const dayPricing = pricingMap.get(key);
    const dayPrice = Number(dayPricing ? dayPricing.price : ratePlan.basePrice);

    nightly.push({ date: key, price: dayPrice });
    roomPrice += dayPrice * safeRooms;
  }

  /* ---------- extra guests ---------- */
  const includedAdults = Number(roomCategory.maxAdults || 2) * safeRooms;
  const includedChildren = Number(roomCategory.maxChildren || 0) * safeRooms;

  const extraAdults = Math.max(0, safeAdults - includedAdults);
  const extraChildren = Math.max(0, safeChildren - includedChildren);

  const extraAdultAmount =
    extraAdults * Number(ratePlan.extraAdultPrice || 0) * totalNights;

  const extraChildAmount =
    extraChildren * Number(ratePlan.extraChildPrice || 0) * totalNights;

  /* ---------- totals ---------- */
  const subTotal = roomPrice + extraAdultAmount + extraChildAmount;

  if (safeDiscount > subTotal) {
    throw new HttpError(400, "Discount cannot be more than the booking subtotal.");
  }

  const taxable = subTotal - safeDiscount;
  const gstAmount = (taxable * Number(ratePlan.gstPercent || 0)) / 100;
  const totalAmount = taxable + gstAmount;

  return {
    resort,
    roomCategory,
    ratePlan,
    checkInDate,
    checkOutDate,
    totalNights,
    stayDates,
    safeRooms,
    safeAdults,
    safeChildren,
    minAvailable,
    nightly,
    extraAdults,
    extraChildren,
    pricing: {
      roomPrice: round2(roomPrice),
      extraAdultAmount: round2(extraAdultAmount),
      extraChildAmount: round2(extraChildAmount),
      gstAmount: round2(gstAmount),
      discountAmount: round2(safeDiscount),
      totalAmount: round2(totalAmount),
    },
  };
};

/* ==========================================================
                    BOOKING OPTIONS (for frontend dropdowns)
   GET /options                  -> vendor resorts
   GET /options?resortId=xxx     -> rooms + rate plans + units
========================================================== */

exports.getBookingOptions = async (req, res) => {
  try {
    const { resortId } = req.query;

    if (!resortId) {
      const resorts = await Resort.find({ vendor: req.vendor._id })
        .select("name address.city address.state status isActive")
        .sort({ name: 1 })
        .lean();

      return res.status(200).json({ success: true, resorts });
    }

    if (!isId(resortId)) {
      throw new HttpError(400, "Invalid resort ID.");
    }

    const resort = await Resort.findOne({
      _id: resortId,
      vendor: req.vendor._id,
    })
      .select("name checkInTime checkOutTime")
      .lean();

    if (!resort) {
      throw new HttpError(404, "Resort not found or access denied.");
    }

    const [rooms, ratePlans, units] = await Promise.all([
      ResortRoom.find({
        resort: resortId,
        vendor: req.vendor._id,
        isActive: true,
      })
        .select("name maxAdults maxChildren maxGuests basePrice")
        .sort({ name: 1 })
        .lean(),

      ResortRatePlan.find({
        resort: resortId,
        vendor: req.vendor._id,
        isActive: true,
      })
        .select(
          "roomCategory name displayName mealPlan basePrice extraAdultPrice extraChildPrice gstPercent minStay maxStay refundable"
        )
        .sort({ displayName: 1 })
        .lean(),

      ResortRoomUnit.find({
        resort: resortId,
        vendor: req.vendor._id,
        isActive: true,
      })
        .select("roomCategory roomNumber floor building status")
        .sort({ roomNumber: 1 })
        .lean(),
    ]);

    const roomCategories = rooms.map((room) => ({
      ...room,
      ratePlans: ratePlans.filter(
        (plan) => String(plan.roomCategory) === String(room._id)
      ),
      units: units.filter(
        (unit) => String(unit.roomCategory) === String(room._id)
      ),
    }));

    return res.status(200).json({ success: true, resort, roomCategories });
  } catch (error) {
    return sendError(res, error, "Resort Booking Options Error");
  }
};

/* ==========================================================
                    PRICE QUOTE (no booking created)
   POST /quote
========================================================== */

exports.getQuote = async (req, res) => {
  try {
    const stay = await prepareStay(req.vendor._id, req.body);

    return res.status(200).json({
      success: true,
      quote: {
        totalNights: stay.totalNights,
        rooms: stay.safeRooms,
        adults: stay.safeAdults,
        children: stay.safeChildren,
        extraAdults: stay.extraAdults,
        extraChildren: stay.extraChildren,
        roomsLeft: stay.minAvailable,
        nightly: stay.nightly,
        pricing: stay.pricing,
      },
    });
  } catch (error) {
    return sendError(res, error, "Resort Booking Quote Error");
  }
};

/* ==========================================================
                    CREATE BOOKING
========================================================== */

exports.createBooking = async (req, res) => {
  let reservedDates = [];
  let inventoryCtx = null;
  let reservedRooms = 0;

  try {
    const {
      leadGuest,
      additionalGuests = [],
      paymentMethod = "CASH",
      bookingSource = "VENDOR_PANEL",
      bookingStatus = "CONFIRMED",
      specialRequest = "",
      internalNotes = "",
      paidAmount = 0,
    } = req.body;

    validateGuest(leadGuest, "Lead guest");

    if (!Array.isArray(additionalGuests)) {
      throw new HttpError(400, "Additional guests must be a list.");
    }

    additionalGuests.forEach((guest, index) =>
      validateGuest(guest, `Additional guest ${index + 1}`)
    );

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new HttpError(400, "Invalid payment method.");
    }

    if (!["PENDING", "CONFIRMED"].includes(bookingStatus)) {
      throw new HttpError(
        400,
        "A new booking can only be PENDING or CONFIRMED."
      );
    }

    const stay = await prepareStay(req.vendor._id, req.body);

    const advance = Number(paidAmount) || 0;

    if (advance < 0 || advance > stay.pricing.totalAmount + 0.009) {
      throw new HttpError(
        400,
        "Paid amount must be between 0 and the total amount."
      );
    }

    /* ---------- reserve inventory atomically ---------- */
    inventoryCtx = {
      vendor: req.vendor._id,
      resort: stay.resort._id,
      roomCategory: stay.roomCategory._id,
    };

    reservedRooms = stay.safeRooms;

    reservedDates = await reserveDates(
      inventoryCtx,
      stay.stayDates,
      stay.safeRooms
    );

    /* ---------- create booking ---------- */
    const payments =
      advance > 0
        ? [{ amount: round2(advance), method: paymentMethod, note: "Advance at booking" }]
        : [];

    const booking = await ResortBooking.create({
      bookingId: generateBookingId(),

      vendor: req.vendor._id,
      resort: stay.resort._id,
      roomCategory: stay.roomCategory._id,
      ratePlan: stay.ratePlan._id,

      checkIn: stay.checkInDate,
      checkOut: stay.checkOutDate,
      totalNights: stay.totalNights,

      rooms: stay.safeRooms,
      adults: stay.safeAdults,
      children: stay.safeChildren,

      leadGuest: cleanGuest(leadGuest),
      additionalGuests: additionalGuests.map(cleanGuest),

      pricing: stay.pricing,

      paymentMethod,
      paidAmount: round2(advance),
      payments,
      paymentStatus: derivePaymentStatus(advance, stay.pricing.totalAmount, "PENDING"),

      bookingSource,
      specialRequest,
      internalNotes,

      bookingStatus,
    });

    const populated = await populateBooking(
      ResortBooking.findById(booking._id)
    );

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      booking: populated,
    });
  } catch (error) {
    /* Booking could not be saved -> give the rooms back */
    if (reservedDates.length && inventoryCtx && !(error instanceof HttpError && error.status === 409)) {
      try {
        await releaseDates(inventoryCtx, reservedDates, reservedRooms);
      } catch (rollbackError) {
        console.error("Inventory rollback failed:", rollbackError);
      }
    }

    return sendError(res, error, "Create Resort Booking Error");
  }
};

/* ==========================================================
                    GET ALL BOOKINGS
   Query: resortId, status, paymentStatus, search,
          dateFrom, dateTo (on check-in), page, limit
========================================================== */

exports.getBookings = async (req, res) => {
  try {
    const {
      resortId,
      status,
      paymentStatus,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { vendor: req.vendor._id };

    if (resortId) {
      if (!isId(resortId)) throw new HttpError(400, "Invalid resort ID.");
      filter.resort = resortId;
    }

    if (status) filter.bookingStatus = String(status).toUpperCase();
    if (paymentStatus) filter.paymentStatus = String(paymentStatus).toUpperCase();

    if (dateFrom || dateTo) {
      filter.checkIn = {};

      if (dateFrom) {
        const from = toUTCDate(dateFrom);
        if (!from) throw new HttpError(400, "Invalid dateFrom.");
        filter.checkIn.$gte = from;
      }

      if (dateTo) {
        const to = toUTCDate(dateTo);
        if (!to) throw new HttpError(400, "Invalid dateTo.");
        filter.checkIn.$lte = to;
      }
    }

    if (search && String(search).trim()) {
      const regex = new RegExp(escapeRegex(String(search).trim()), "i");

      filter.$or = [
        { bookingId: regex },
        { "leadGuest.name": regex },
        { "leadGuest.phone": regex },
        { "leadGuest.email": regex },
      ];
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [bookings, total] = await Promise.all([
      populateBooking(
        ResortBooking.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(safeLimit)
      ),
      ResortBooking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      bookings,
    });
  } catch (error) {
    return sendError(res, error, "Get Resort Bookings Error");
  }
};

/* ==========================================================
                    GET SINGLE BOOKING
========================================================== */

exports.getBookingById = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const booking = await ResortBooking.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    })
      .populate("resort")
      .populate("roomCategory")
      .populate("ratePlan")
      .populate("roomUnit");

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return sendError(res, error, "Get Resort Booking Error");
  }
};

/* ==========================================================
                    UPDATE BOOKING DETAILS
   Guests, notes, payment method only.
   Dates / rooms / price cannot change here (cancel & rebook).
========================================================== */

exports.updateBooking = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const booking = await ResortBooking.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    if (["CANCELLED", "NO_SHOW"].includes(booking.bookingStatus)) {
      throw new HttpError(
        400,
        `A ${booking.bookingStatus.replace("_", " ").toLowerCase()} booking cannot be edited.`
      );
    }

    const {
      leadGuest,
      additionalGuests,
      specialRequest,
      internalNotes,
      paymentMethod,
    } = req.body;

    if (leadGuest !== undefined) {
      validateGuest(leadGuest, "Lead guest");
      booking.leadGuest = cleanGuest(leadGuest);
    }

    if (additionalGuests !== undefined) {
      if (!Array.isArray(additionalGuests)) {
        throw new HttpError(400, "Additional guests must be a list.");
      }

      additionalGuests.forEach((guest, index) =>
        validateGuest(guest, `Additional guest ${index + 1}`)
      );

      booking.additionalGuests = additionalGuests.map(cleanGuest);
    }

    if (specialRequest !== undefined) {
      booking.specialRequest = String(specialRequest).trim();
    }

    if (internalNotes !== undefined) {
      booking.internalNotes = String(internalNotes).trim();
    }

    if (paymentMethod !== undefined) {
      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw new HttpError(400, "Invalid payment method.");
      }

      booking.paymentMethod = paymentMethod;
    }

    await booking.save();

    const populated = await populateBooking(ResortBooking.findById(booking._id));

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully.",
      booking: populated,
    });
  } catch (error) {
    return sendError(res, error, "Update Resort Booking Error");
  }
};

/* ==========================================================
                    ROOM UNIT VALIDATION (shared)
========================================================== */

const validateRoomUnit = async (booking, unitId, vendorId) => {
  if (!isId(unitId)) {
    throw new HttpError(400, "Invalid room unit ID.");
  }

  const unit = await ResortRoomUnit.findOne({
    _id: unitId,
    vendor: vendorId,
    resort: booking.resort,
    roomCategory: booking.roomCategory,
    isActive: true,
  });

  if (!unit) {
    throw new HttpError(
      404,
      "Room unit not found for this resort and room category."
    );
  }

  if (["INACTIVE", "BLOCKED", "MAINTENANCE"].includes(unit.status)) {
    throw new HttpError(
      400,
      `Room ${unit.roomNumber} is ${unit.status.toLowerCase()} and cannot be assigned.`
    );
  }

  const clash = await ResortBooking.findOne({
    _id: { $ne: booking._id },
    roomUnit: unit._id,
    bookingStatus: { $in: ACTIVE_STATUSES },
    checkIn: { $lt: booking.checkOut },
    checkOut: { $gt: booking.checkIn },
  }).select("bookingId");

  if (clash) {
    throw new HttpError(
      409,
      `Room ${unit.roomNumber} is already assigned to booking ${clash.bookingId} for these dates.`
    );
  }

  return unit;
};

/* ==========================================================
                    ASSIGN / CLEAR ROOM UNIT
   PATCH /:id/room-unit   body: { roomUnitId } (null to clear)
========================================================== */

exports.assignRoomUnit = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const booking = await ResortBooking.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    if (!ACTIVE_STATUSES.includes(booking.bookingStatus)) {
      throw new HttpError(
        400,
        "Room can only be assigned to pending, confirmed or checked-in bookings."
      );
    }

    const { roomUnitId } = req.body;

    if (!roomUnitId) {
      booking.roomUnit = null;
    } else {
      const unit = await validateRoomUnit(booking, roomUnitId, req.vendor._id);
      booking.roomUnit = unit._id;
    }

    await booking.save();

    const populated = await populateBooking(ResortBooking.findById(booking._id));

    return res.status(200).json({
      success: true,
      message: roomUnitId ? "Room assigned successfully." : "Room assignment cleared.",
      booking: populated,
    });
  } catch (error) {
    return sendError(res, error, "Assign Room Unit Error");
  }
};

/* ==========================================================
                    UPDATE BOOKING STATUS
   PUT /:id/status
   body: { bookingStatus, cancellationReason?, refundAmount?, roomUnitId? }
========================================================== */

exports.updateBookingStatus = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const { bookingStatus, cancellationReason, refundAmount, roomUnitId } =
      req.body;

    if (!Object.keys(STATUS_TRANSITIONS).includes(bookingStatus)) {
      throw new HttpError(400, "Invalid booking status.");
    }

    const booking = await ResortBooking.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    if (booking.bookingStatus === bookingStatus) {
      throw new HttpError(400, `Booking is already ${bookingStatus}.`);
    }

    const allowed = STATUS_TRANSITIONS[booking.bookingStatus] || [];

    if (!allowed.includes(bookingStatus)) {
      throw new HttpError(
        400,
        `Cannot change status from ${booking.bookingStatus} to ${bookingStatus}.`
      );
    }

    /* ---------- CHECK-IN ---------- */
    if (bookingStatus === "CHECKED_IN") {
      if (roomUnitId) {
        const unit = await validateRoomUnit(booking, roomUnitId, req.vendor._id);
        booking.roomUnit = unit._id;
      }

      booking.checkedInAt = new Date();
    }

    /* ---------- CHECK-OUT ---------- */
    if (bookingStatus === "CHECKED_OUT") {
      booking.checkedOutAt = new Date();
    }

    /* ---------- CANCEL / NO-SHOW ---------- */
    if (bookingStatus === "CANCELLED" || bookingStatus === "NO_SHOW") {
      const refund = Number(refundAmount) || 0;

      // Validate BEFORE touching inventory
      if (refund < 0 || refund > booking.paidAmount + 0.009) {
        throw new HttpError(
          400,
          "Refund amount cannot be more than the amount paid."
        );
      }

      if (!booking.inventoryReleased) {
        await releaseBookingInventory(booking);
        booking.inventoryReleased = true;
      }

      if (bookingStatus === "CANCELLED") {
        booking.cancelledAt = new Date();
        booking.cancellationReason = String(cancellationReason || "").trim();
        booking.cancelledBy = "VENDOR";
      }

      if (refund > 0) {
        booking.refundAmount = round2(refund);
        booking.paymentStatus =
          refund + 0.009 >= booking.paidAmount ? "REFUNDED" : "PARTIAL";
      }
    }

    booking.bookingStatus = bookingStatus;

    await booking.save();

    /* ---------- keep room unit status in sync ---------- */
    if (booking.roomUnit) {
      let unitStatus = null;

      if (bookingStatus === "CHECKED_IN") unitStatus = "OCCUPIED";
      if (bookingStatus === "CHECKED_OUT") unitStatus = "CLEANING";

      if (unitStatus) {
        await ResortRoomUnit.updateOne(
          { _id: booking.roomUnit, vendor: req.vendor._id },
          { $set: { status: unitStatus } }
        );
      }
    }

    const populated = await populateBooking(ResortBooking.findById(booking._id));

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully.",
      booking: populated,
    });
  } catch (error) {
    return sendError(res, error, "Update Resort Booking Status Error");
  }
};

/* ==========================================================
                    ADD PAYMENT
   POST /:id/payments   body: { amount, method?, note? }
========================================================== */

exports.addPayment = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const amount = Number(req.body.amount);
    const method = req.body.method || "CASH";
    const note = String(req.body.note || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, "Payment amount must be greater than 0.");
    }

    if (!PAYMENT_METHODS.includes(method)) {
      throw new HttpError(400, "Invalid payment method.");
    }

    const booking = await ResortBooking.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    if (["CANCELLED", "NO_SHOW"].includes(booking.bookingStatus)) {
      throw new HttpError(
        400,
        "Payments cannot be added to a cancelled or no-show booking."
      );
    }

    const due = round2(booking.pricing.totalAmount - booking.paidAmount);

    if (amount > due + 0.009) {
      throw new HttpError(
        400,
        `Payment exceeds the balance due (₹${due}).`
      );
    }

    booking.payments.push({ amount: round2(amount), method, note });
    booking.paidAmount = round2(booking.paidAmount + amount);
    booking.paymentMethod = method;
    booking.paymentStatus = derivePaymentStatus(
      booking.paidAmount,
      booking.pricing.totalAmount,
      booking.paymentStatus
    );

    await booking.save();

    const populated = await populateBooking(ResortBooking.findById(booking._id));

    return res.status(200).json({
      success: true,
      message: "Payment recorded successfully.",
      booking: populated,
    });
  } catch (error) {
    return sendError(res, error, "Add Resort Booking Payment Error");
  }
};

/* ==========================================================
                    DELETE BOOKING
   Only cancelled / no-show bookings can be deleted.
========================================================== */

exports.deleteBooking = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const booking = await ResortBooking.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    if (!["CANCELLED", "NO_SHOW"].includes(booking.bookingStatus)) {
      throw new HttpError(
        400,
        "Only cancelled or no-show bookings can be deleted. Cancel the booking first."
      );
    }

    if (!booking.inventoryReleased) {
      await releaseBookingInventory(booking);
    }

    await booking.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully.",
    });
  } catch (error) {
    return sendError(res, error, "Delete Resort Booking Error");
  }
};

/* ==========================================================
                    DASHBOARD STATS
   GET /stats?resortId=&today=YYYY-MM-DD
========================================================== */

exports.getStats = async (req, res) => {
  try {
    const { resortId, today } = req.query;

    const base = { vendor: new mongoose.Types.ObjectId(String(req.vendor._id)) };

    if (resortId) {
      if (!isId(resortId)) throw new HttpError(400, "Invalid resort ID.");
      base.resort = new mongoose.Types.ObjectId(resortId);
    }

    const todayDate = toUTCDate(today || new Date());

    const [byStatus, money, todayCheckIns, todayCheckOuts, upcoming] =
      await Promise.all([
        ResortBooking.aggregate([
          { $match: base },
          { $group: { _id: "$bookingStatus", count: { $sum: 1 } } },
        ]),

        ResortBooking.aggregate([
          {
            $match: {
              ...base,
              bookingStatus: { $nin: ["CANCELLED", "NO_SHOW"] },
            },
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: "$pricing.totalAmount" },
              collected: { $sum: "$paidAmount" },
            },
          },
        ]),

        ResortBooking.countDocuments({
          ...base,
          checkIn: todayDate,
          bookingStatus: { $in: ["PENDING", "CONFIRMED"] },
        }),

        ResortBooking.countDocuments({
          ...base,
          checkOut: todayDate,
          bookingStatus: "CHECKED_IN",
        }),

        ResortBooking.countDocuments({
          ...base,
          checkIn: { $gt: todayDate },
          bookingStatus: { $in: ["PENDING", "CONFIRMED"] },
        }),
      ]);

    const statusCounts = {
      PENDING: 0,
      CONFIRMED: 0,
      CHECKED_IN: 0,
      CHECKED_OUT: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
    };

    byStatus.forEach((row) => {
      statusCounts[row._id] = row.count;
    });

    const revenue = money[0] ? money[0].revenue : 0;
    const collected = money[0] ? money[0].collected : 0;

    return res.status(200).json({
      success: true,
      stats: {
        statusCounts,
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        todayCheckIns,
        todayCheckOuts,
        upcoming,
        inHouse: statusCounts.CHECKED_IN,
        revenue: round2(revenue),
        collected: round2(collected),
        due: round2(revenue - collected),
      },
    });
  } catch (error) {
    return sendError(res, error, "Resort Booking Stats Error");
  }
};


/* ==========================================================
   CUSTOMER: HELPER TO RESOLVE RESORT OWNER
========================================================== */

const prepareCustomerStay = async (body) => {
  const bookingInput = {
    ...body,
    resortId: body.resortId || body.resort,
    roomCategoryId: body.roomCategoryId || body.roomCategory,
    ratePlanId: body.ratePlanId || body.ratePlan,
  };

  if (!isId(bookingInput.resortId)) {
    throw new HttpError(400, "Valid resortId is required.");
  }

  const resort = await Resort.findById(bookingInput.resortId)
    .select("vendor");

  if (!resort) {
    throw new HttpError(404, "Resort not found.");
  }

  // Owner is always taken from the database, not request body.
  const stay = await prepareStay(resort.vendor, bookingInput);

  return { stay, vendorId: resort.vendor };
};


/* ==========================================================
   CUSTOMER: GET PRICE QUOTE
========================================================== */

exports.customerGetQuote = async (req, res) => {
  try {
    const { stay } = await prepareCustomerStay(req.body);

    return res.status(200).json({
      success: true,
      quote: {
        totalNights: stay.totalNights,
        rooms: stay.safeRooms,
        adults: stay.safeAdults,
        children: stay.safeChildren,
        extraAdults: stay.extraAdults,
        extraChildren: stay.extraChildren,
        roomsLeft: stay.minAvailable,
        nightly: stay.nightly,
        pricing: stay.pricing,
      },
    });
  } catch (error) {
    return sendError(res, error, "Customer Resort Quote Error");
  }
};


/* ==========================================================
   CUSTOMER: CREATE BOOKING
========================================================== */

exports.customerCreateBooking = async (req, res) => {
  let reservedDates = [];
  let inventoryCtx = null;
  let reservedRooms = 0;

  try {
    const {
      leadGuest,
      additionalGuests = [],
      specialRequest = "",
    } = req.body;

    validateGuest(leadGuest, "Lead guest");

    if (!Array.isArray(additionalGuests)) {
      throw new HttpError(400, "Additional guests must be a list.");
    }

    additionalGuests.forEach((guest, index) =>
      validateGuest(guest, `Additional guest ${index + 1}`)
    );

    const { stay, vendorId } = await prepareCustomerStay(req.body);

    inventoryCtx = {
      vendor: vendorId,
      resort: stay.resort._id,
      roomCategory: stay.roomCategory._id,
    };

    reservedRooms = stay.safeRooms;

    reservedDates = await reserveDates(
      inventoryCtx,
      stay.stayDates,
      stay.safeRooms
    );

    const booking = await ResortBooking.create({
      bookingId: generateBookingId(),

      customer: req.user._id,
      vendor: vendorId,
      resort: stay.resort._id,
      roomCategory: stay.roomCategory._id,
      ratePlan: stay.ratePlan._id,

      checkIn: stay.checkInDate,
      checkOut: stay.checkOutDate,
      totalNights: stay.totalNights,

      rooms: stay.safeRooms,
      adults: stay.safeAdults,
      children: stay.safeChildren,

      leadGuest: cleanGuest(leadGuest),
      additionalGuests: additionalGuests.map(cleanGuest),

      pricing: stay.pricing,

      bookingStatus: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "ONLINE",
      paidAmount: 0,
      payments: [],

      bookingSource: "WEBSITE",
      specialRequest: String(specialRequest || "").trim(),
      internalNotes: "",
    });

    const result = await populateBooking(
      ResortBooking.findById(booking._id)
    );

    return res.status(201).json({
      success: true,
      message: "Booking created successfully. Awaiting confirmation/payment.",
      booking: result,
    });
  } catch (error) {
    if (reservedDates.length && inventoryCtx) {
      try {
        await releaseDates(
          inventoryCtx,
          reservedDates,
          reservedRooms
        );
      } catch (rollbackError) {
        console.error("Customer booking inventory rollback failed:", rollbackError);
      }
    }

    return sendError(res, error, "Customer Create Booking Error");
  }
};


/* ==========================================================
   CUSTOMER: GET MY BOOKINGS
========================================================== */

exports.customerGetBookings = async (req, res) => {
  try {
    const bookings = await populateBooking(
      ResortBooking.find({ customer: req.user._id })
        .sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      total: bookings.length,
      bookings,
    });
  } catch (error) {
    return sendError(res, error, "Customer Get Bookings Error");
  }
};


/* ==========================================================
   CUSTOMER: GET MY BOOKING BY ID
========================================================== */

exports.customerGetBookingById = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const booking = await populateBooking(
      ResortBooking.findOne({
        _id: req.params.id,
        customer: req.user._id,
      })
    );

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    return sendError(res, error, "Customer Get Booking Error");
  }
};


/* ==========================================================
   CUSTOMER: UPDATE GUEST DETAILS
========================================================== */

exports.customerUpdateBooking = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const booking = await ResortBooking.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    if (booking.bookingStatus !== "PENDING") {
      throw new HttpError(
        400,
        "Only pending bookings can be edited."
      );
    }

    const {
      leadGuest,
      additionalGuests,
      specialRequest,
    } = req.body;

    if (leadGuest !== undefined) {
      validateGuest(leadGuest, "Lead guest");
      booking.leadGuest = cleanGuest(leadGuest);
    }

    if (additionalGuests !== undefined) {
      if (!Array.isArray(additionalGuests)) {
        throw new HttpError(400, "Additional guests must be a list.");
      }

      additionalGuests.forEach((guest, index) =>
        validateGuest(guest, `Additional guest ${index + 1}`)
      );

      booking.additionalGuests = additionalGuests.map(cleanGuest);
    }

    if (specialRequest !== undefined) {
      booking.specialRequest = String(specialRequest || "").trim();
    }

    // Customer cannot change vendor, price, dates, status or payment.
    await booking.save();

    const result = await populateBooking(
      ResortBooking.findById(booking._id)
    );

    return res.status(200).json({
      success: true,
      message: "Booking details updated successfully.",
      booking: result,
    });
  } catch (error) {
    return sendError(res, error, "Customer Update Booking Error");
  }
};


/* ==========================================================
   CUSTOMER: CANCEL BOOKING
   DELETE endpoint performs a cancellation, not hard delete.
========================================================== */

exports.customerCancelBooking = async (req, res) => {
  try {
    if (!isId(req.params.id)) {
      throw new HttpError(400, "Invalid booking ID.");
    }

    const booking = await ResortBooking.findOne({
      _id: req.params.id,
      customer: req.user._id,
    });

    if (!booking) {
      throw new HttpError(404, "Booking not found.");
    }

    if (booking.bookingStatus !== "PENDING") {
      throw new HttpError(
        400,
        "Only pending bookings can be cancelled by the customer."
      );
    }

    if (!booking.inventoryReleased) {
      await releaseBookingInventory(booking);
      booking.inventoryReleased = true;
    }

    booking.bookingStatus = "CANCELLED";
    booking.cancelledAt = new Date();
    booking.cancelledBy = "USER";
    booking.cancellationReason = String(
      req.body?.cancellationReason || "Cancelled by customer"
    ).trim();

    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
      booking,
    });
  } catch (error) {
    return sendError(res, error, "Customer Cancel Booking Error");
  }
};
