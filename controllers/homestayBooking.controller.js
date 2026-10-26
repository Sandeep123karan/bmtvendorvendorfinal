const mongoose = require("mongoose");

const Homestay = require("../models/Homestay.model");
const HomestayRoom = require("../models/Homestayroom.model");
const HomestayInventory = require("../models/HomestayInventory.model");
const HomestayBooking = require("../models/HomestayBooking.model");

const {
  httpError,
  sendError,
  round,
  normalizeDate,
  getStayDates,
  dateKey,
} = require("../utils/Homestayhelpers");

const {
  confirmBookingWithInventory,
  restoreInventoryForBooking,
} = require("../services/Homestayinventory.service");

const BOOKABLE_HOMESTAY_STATUSES = ["APPROVED"]; // testing ke liye "PENDING" bhi add kar sakte ho
const MAX_EXTRA_GUESTS_PER_ROOM = 2; // free capacity ke upar max extra guests (agar extraGuestPrice set hai)
const PAYMENT_METHODS = ["ONLINE", "UPI", "CARD", "NET_BANKING", "PAY_AT_PROPERTY", "COD"];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const requireUser = (req) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) throw httpError(401, "User authentication required.");
  return userId;
};

const requireVendor = (req) => {
  const vendorId = req.vendor?._id;
  if (!vendorId) throw httpError(401, "Vendor authentication required.");
  return vendorId;
};

const findVendorBooking = async (req) => {
  const vendorId = requireVendor(req);
  if (!isValidId(req.params.bookingId)) throw httpError(400, "Invalid booking ID.");
  const booking = await HomestayBooking.findOne({ _id: req.params.bookingId, vendor: vendorId });
  if (!booking) throw httpError(404, "Booking not found.");
  return { booking, vendorId };
};

/* ============================================================
   QUOTE  (availability check + price)  -- create & availability dono use karte hain
============================================================ */
const buildQuote = async ({ roomId, checkInDate, checkOutDate, unitsBooked, adults, children }) => {
  if (!roomId || !isValidId(roomId)) throw httpError(400, "Valid room ID is required.");

  const checkIn = normalizeDate(checkInDate);
  const checkOut = normalizeDate(checkOutDate);
  if (!checkIn || !checkOut) throw httpError(400, "Valid check-in and check-out dates are required.");
  if (checkOut <= checkIn) throw httpError(400, "Check-out date must be after check-in date.");
  if (checkIn < normalizeDate(new Date())) throw httpError(400, "Check-in date cannot be in the past.");

  const room = await HomestayRoom.findById(roomId);
  if (!room) throw httpError(404, "Room not found.");
  if (!room.isActive) throw httpError(400, "This room is currently inactive.");

  const homestay = await Homestay.findById(room.homestay);
  if (!homestay) throw httpError(404, "Homestay not found.");
  if (!homestay.isActive) throw httpError(400, "Homestay is currently inactive.");
  if (!BOOKABLE_HOMESTAY_STATUSES.includes(homestay.status)) {
    throw httpError(400, "Homestay is not available for booking.");
  }

  const units = Math.max(parseInt(unitsBooked, 10) || 1, 1);
  const adultsN = Math.max(parseInt(adults, 10) || 1, 1);
  const childrenN = Math.max(parseInt(children, 10) || 0, 0);
  const totalGuests = adultsN + childrenN;

  /* guest capacity */
  const freeCapacity = (room.maxGuests || 0) * units;
  const roomExtraPrice = room.pricing?.extraGuestPrice || 0;
  if (freeCapacity > 0) {
    const maxCapacity = freeCapacity + (roomExtraPrice > 0 ? MAX_EXTRA_GUESTS_PER_ROOM * units : 0);
    if (totalGuests > maxCapacity) {
      throw httpError(400, `Maximum ${maxCapacity} guests allowed for ${units} room(s).`);
    }
  }
  const extraGuests = freeCapacity > 0 ? Math.max(totalGuests - freeCapacity, 0) : 0;

  /* inventory har raat ke liye */
  const dates = getStayDates(checkIn, checkOut);
  const nights = dates.length;

  const inventories = await HomestayInventory.find({
    room: room._id,
    date: { $gte: dates[0], $lte: dates[nights - 1] },
  }).sort({ date: 1 });

  if (inventories.length !== nights) {
    throw httpError(400, "Inventory is not open for all selected dates.");
  }

  for (const inv of inventories) {
    const key = dateKey(inv.date);
    if (inv.isBlocked) throw httpError(400, `Room is blocked for ${key}.`);
    if (inv.stopSell) throw httpError(400, `Booking is stopped for ${key}.`);
    if (inv.closedForBooking) throw httpError(400, `Booking is closed for ${key}.`);
    if (!inv.isAvailable) throw httpError(400, `Room is unavailable for ${key}.`);
    if (inv.availableUnits < units) {
      throw httpError(400, `Only ${inv.availableUnits} room(s) available for ${key}.`);
    }
  }

  const first = inventories[0];
  if (!first.checkInAllowed) throw httpError(400, `Check-in is not allowed on ${dateKey(first.date)}.`);
  if (first.minimumStay > nights) throw httpError(400, `Minimum stay is ${first.minimumStay} night(s).`);
  if (first.maximumStay > 0 && nights > first.maximumStay) {
    throw httpError(400, `Maximum stay is ${first.maximumStay} night(s).`);
  }

  const checkOutInv = await HomestayInventory.findOne({ room: room._id, date: checkOut }).select("checkOutAllowed");
  if (checkOutInv && checkOutInv.checkOutAllowed === false) {
    throw httpError(400, `Check-out is not allowed on ${dateKey(checkOut)}.`);
  }

  /* price */
  let roomAmount = 0;
  let discountAmount = 0;
  let extraGuestAmount = 0;
  let taxAmount = 0;
  let serviceChargeAmount = 0;

  inventories.forEach((inv) => {
    roomAmount += inv.finalPrice * units;
    discountAmount += Math.max(inv.appliedPrice - inv.finalPrice, 0) * units;
    extraGuestAmount += extraGuests * (inv.extraGuestPrice || roomExtraPrice);
    taxAmount += inv.taxAmount * units;
    serviceChargeAmount += inv.serviceChargeAmount * units;
  });

  roomAmount = round(roomAmount);
  extraGuestAmount = round(extraGuestAmount);
  const subtotal = round(roomAmount + extraGuestAmount);

  return {
    room,
    homestay,
    checkIn,
    checkOut,
    nights,
    units,
    adults: adultsN,
    children: childrenN,
    totalGuests,
    inventories,
    price: {
      pricePerNight: round(roomAmount / (nights * units)),
      roomAmount,
      extraGuestAmount,
      discountAmount: round(discountAmount),
      subtotal,
      taxPercentage: first.taxPercentage || 0,
      taxAmount: round(taxAmount),
      serviceChargePercentage: first.serviceChargePercentage || 0,
      serviceChargeAmount: round(serviceChargeAmount),
      totalAmount: round(subtotal + taxAmount + serviceChargeAmount),
    },
  };
};

/* ============================================================
   GET /availability  (public)  ?roomId&checkInDate&checkOutDate&unitsBooked&adults&children
============================================================ */
exports.checkAvailability = async (req, res) => {
  try {
    const q = req.query;
    const quote = await buildQuote({
      roomId: q.roomId,
      checkInDate: q.checkInDate,
      checkOutDate: q.checkOutDate,
      unitsBooked: q.unitsBooked,
      adults: q.adults,
      children: q.children,
    });

    return res.status(200).json({
      success: true,
      available: true,
      nights: quote.nights,
      unitsBooked: quote.units,
      price: quote.price,
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(200).json({ success: true, available: false, message: err.message });
    }
    return sendError(res, err, "Failed to check availability.", "Availability Error");
  }
};

/* ============================================================
   POST /  (user)  -> PENDING booking, inventory abhi minus nahi
   body: roomId, checkInDate, checkOutDate, adults, children, infants, unitsBooked,
         guestName, guestEmail, guestPhone, specialRequest, paymentMethod
============================================================ */
exports.createBooking = async (req, res) => {
  try {
    const userId = requireUser(req);
    const b = req.body;

    const quote = await buildQuote({
      roomId: b.roomId,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      unitsBooked: b.unitsBooked,
      adults: b.adults,
      children: b.children,
    });

    const guestName = String(b.guestName || req.user.fullname || req.user.name || "").trim();
    const guestEmail = String(b.guestEmail || req.user.email || "").trim();
    const guestPhone = String(b.guestPhone || req.user.phone || "").trim();
    if (!guestName || !guestEmail || !guestPhone) {
      throw httpError(400, "Guest name, email and phone are required.");
    }

    const { price } = quote;

    const booking = await HomestayBooking.create({
      user: userId,
      guestName,
      guestEmail,
      guestPhone,
      alternatePhone: b.alternatePhone || "",

      homestay: quote.homestay._id,
      room: quote.room._id,
      inventory: quote.inventories[0]._id,
      vendor: quote.homestay.vendor,

      checkInDate: quote.checkIn,
      checkOutDate: quote.checkOut,
      nights: quote.nights,
      unitsBooked: quote.units,

      adults: quote.adults,
      children: quote.children,
      infants: Math.max(Number(b.infants) || 0, 0),
      guestNames: Array.isArray(b.guestNames) ? b.guestNames : [],
      specialRequest: b.specialRequest || "",

      pricePerNight: price.pricePerNight,
      roomAmount: price.roomAmount,
      extraGuestAmount: price.extraGuestAmount,
      discountAmount: price.discountAmount,
      subtotal: price.subtotal,
      taxPercentage: price.taxPercentage,
      taxAmount: price.taxAmount,
      serviceChargePercentage: price.serviceChargePercentage,
      serviceChargeAmount: price.serviceChargeAmount,
      totalAmount: price.totalAmount,

      paymentMethod: PAYMENT_METHODS.includes(b.paymentMethod) ? b.paymentMethod : "ONLINE",
      paymentStatus: "PENDING",
      bookingStatus: "PENDING",
      vendorConfirmation: "PENDING",
      inventoryDeducted: false,

      adminCommissionType: "PERCENTAGE",
      adminCommissionPercentage: 0,
      adminCommissionAmount: 0,
      vendorAmount: price.totalAmount,
      settlementStatus: "PENDING",

      bookingSource: b.bookingSource || "WEBSITE",
    });

    return res.status(201).json({
      success: true,
      message: "Booking request created. Inventory will be reserved once the booking is confirmed.",
      booking,
    });
  } catch (err) {
    return sendError(res, err, "Failed to create homestay booking.", "Create Booking Error");
  }
};

/* ============================================================
   USER: my bookings
============================================================ */
exports.getMyBookings = async (req, res) => {
  try {
    const userId = requireUser(req);
    const bookings = await HomestayBooking.find({ user: userId })
      .populate("homestay", "propertyName city state coverImage averageRating")
      .populate("room", "roomName roomType images")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    return sendError(res, err, "Failed to fetch bookings.", "Get My Bookings Error");
  }
};

exports.getMyBookingById = async (req, res) => {
  try {
    const userId = requireUser(req);
    if (!isValidId(req.params.bookingId)) throw httpError(400, "Invalid booking ID.");

    const booking = await HomestayBooking.findOne({ _id: req.params.bookingId, user: userId })
      .populate("homestay")
      .populate("room");
    if (!booking) throw httpError(404, "Booking not found.");

    return res.status(200).json({ success: true, booking });
  } catch (err) {
    return sendError(res, err, "Failed to fetch booking.", "Get Booking Error");
  }
};

/* ============================================================
   VENDOR: list / single
============================================================ */
exports.getVendorBookings = async (req, res) => {
  try {
    const vendorId = requireVendor(req);
    const { status, paymentStatus, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = { vendor: vendorId };
    if (status) filter.bookingStatus = String(status).toUpperCase();
    if (paymentStatus) filter.paymentStatus = String(paymentStatus).toUpperCase();

    const start = startDate ? normalizeDate(startDate) : null;
    const end = endDate ? normalizeDate(endDate) : null;
    if ((startDate && !start) || (endDate && !end)) throw httpError(400, "Invalid date range.");
    if (start || end) {
      filter.checkInDate = {};
      if (start) filter.checkInDate.$gte = start;
      if (end) filter.checkInDate.$lte = end;
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const [bookings, total] = await Promise.all([
      HomestayBooking.find(filter)
        .populate("homestay", "propertyName city state coverImage")
        .populate("room", "roomName roomType")
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      HomestayBooking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.max(Math.ceil(total / limitNumber), 1),
      },
      bookings,
    });
  } catch (err) {
    return sendError(res, err, "Failed to fetch vendor bookings.", "Get Vendor Bookings Error");
  }
};

exports.getVendorBookingById = async (req, res) => {
  try {
    const { booking } = await findVendorBooking(req);
    await booking.populate([
      { path: "homestay" },
      { path: "room" },
      { path: "user", select: "-password -refreshToken" },
    ]);
    return res.status(200).json({ success: true, booking });
  } catch (err) {
    return sendError(res, err, "Failed to fetch booking.", "Get Vendor Booking Error");
  }
};

/* ============================================================
   VENDOR: confirm  ->  CONFIRMED + inventory minus
============================================================ */
exports.confirmBooking = async (req, res) => {
  try {
    const { booking } = await findVendorBooking(req);
    await confirmBookingWithInventory(booking);

    return res.status(200).json({
      success: true,
      message: "Booking confirmed and inventory updated.",
      booking,
    });
  } catch (err) {
    return sendError(res, err, "Failed to confirm booking.", "Confirm Booking Error");
  }
};

/* ============================================================
   Cancel / Reject common logic  ->  inventory wapas plus
============================================================ */
const releaseBooking = async (booking, { status, cancelledBy, reason }) => {
  await restoreInventoryForBooking(booking);

  booking.bookingStatus = status;

  if (status === "REJECTED") {
    booking.vendorConfirmation = "REJECTED";
    booking.vendorRejectionReason = reason;
  } else {
    booking.cancellationRequested = true;
  }

  booking.cancelledBy = cancelledBy;
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason;

  if (booking.paymentStatus === "PAID") {
    booking.refundAmount = booking.totalAmount;
    booking.refundStatus = "PENDING";
    booking.paymentStatus = "REFUND_PENDING";
  }

  await booking.save();
};

/* VENDOR reject (PENDING ya CONFIRMED) */
exports.rejectBooking = async (req, res) => {
  try {
    const { booking } = await findVendorBooking(req);

    if (!["PENDING", "CONFIRMED"].includes(booking.bookingStatus)) {
      throw httpError(400, `A ${booking.bookingStatus} booking cannot be rejected.`);
    }

    await releaseBooking(booking, {
      status: "REJECTED",
      cancelledBy: "VENDOR",
      reason: req.body.reason || "Booking rejected by vendor",
    });

    return res.status(200).json({
      success: true,
      message: "Booking rejected and inventory restored.",
      booking,
    });
  } catch (err) {
    return sendError(res, err, "Failed to reject booking.", "Reject Booking Error");
  }
};

/* USER cancel */
exports.cancelBooking = async (req, res) => {
  try {
    const userId = requireUser(req);
    if (!isValidId(req.params.bookingId)) throw httpError(400, "Invalid booking ID.");

    const booking = await HomestayBooking.findOne({ _id: req.params.bookingId, user: userId });
    if (!booking) throw httpError(404, "Booking not found.");

    if (!["PENDING", "CONFIRMED"].includes(booking.bookingStatus)) {
      throw httpError(400, "Booking cannot be cancelled.");
    }

    await releaseBooking(booking, {
      status: "CANCELLED",
      cancelledBy: "USER",
      reason: req.body.reason || "Cancelled by customer",
    });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
      booking,
    });
  } catch (err) {
    return sendError(res, err, "Failed to cancel booking.", "Cancel Booking Error");
  }
};

/* ============================================================
   VENDOR: check-in / check-out / complete
============================================================ */
exports.checkIn = async (req, res) => {
  try {
    const { booking, vendorId } = await findVendorBooking(req);
    if (booking.bookingStatus !== "CONFIRMED") {
      throw httpError(400, "Only confirmed bookings can be checked in.");
    }
    booking.bookingStatus = "CHECKED_IN";
    booking.actualCheckInAt = new Date();
    booking.checkInBy = vendorId.toString();
    await booking.save();
    return res.status(200).json({ success: true, message: "Guest checked in successfully.", booking });
  } catch (err) {
    return sendError(res, err, "Failed to check in guest.", "Check In Error");
  }
};

exports.checkOut = async (req, res) => {
  try {
    const { booking, vendorId } = await findVendorBooking(req);
    if (booking.bookingStatus !== "CHECKED_IN") {
      throw httpError(400, "Guest must be checked in before checkout.");
    }
    booking.bookingStatus = "CHECKED_OUT";
    booking.actualCheckOutAt = new Date();
    booking.checkOutBy = vendorId.toString();
    await booking.save();
    return res.status(200).json({ success: true, message: "Guest checked out successfully.", booking });
  } catch (err) {
    return sendError(res, err, "Failed to check out guest.", "Check Out Error");
  }
};

exports.completeBooking = async (req, res) => {
  try {
    const { booking } = await findVendorBooking(req);
    if (booking.bookingStatus !== "CHECKED_OUT") {
      throw httpError(400, "Only checked-out bookings can be completed.");
    }
    booking.bookingStatus = "COMPLETED";
    await booking.save();
    return res.status(200).json({ success: true, message: "Booking completed successfully.", booking });
  } catch (err) {
    return sendError(res, err, "Failed to complete booking.", "Complete Booking Error");
  }
};