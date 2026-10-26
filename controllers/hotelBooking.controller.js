// controllers/HotelBooking.controller.js
// Ek hi file: VENDOR (manage) + PUBLIC (hotel list/availability) + CUSTOMER (booking)

const mongoose = require("mongoose");

const Hotel = require("../models/Hotel.model");
const HotelRoom = require("../models/HotelRoom.model");
const HotelBooking = require("../models/HotelBooking.model");

const {
  normalizeDate,
  label,
  nightList,
  getInventoryOrDefault,
  deductInventory,
  releaseInventory,
} = require("../utils/Hotelinventory.helper");

/* Admin commission server se set hota hai (.env: HOTEL_COMMISSION_PERCENT=10) */
const COMMISSION_PERCENT = Number(process.env.HOTEL_COMMISSION_PERCENT || 0);

/* Customer ko sirf is status wale hotels dikhenge (.env: PUBLIC_HOTEL_STATUS) */
const PUBLIC_HOTEL_STATUS = process.env.PUBLIC_HOTEL_STATUS || "approved";
const HIDDEN_ROOM_STATUSES = ["INACTIVE", "REJECTED"];

const PAYMENT_METHODS = ["ONLINE", "UPI", "CARD", "NET_BANKING", "PAY_AT_HOTEL", "CASH"];
/* Razorpay lagne tak customer sirf hotel par pay karega */
const CUSTOMER_PAYMENT_METHODS = ["PAY_AT_HOTEL"];

/* ============================================================
   HELPERS
============================================================ */

const getVendorId = (req) =>
  req.vendor?._id || req.vendor?.id || req.user?.vendorId || req.user?._id;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const toBool = (v) => v === true || v === "true" || v === "1" || v === 1;

const fail = (status, message) => ({ error: { status, message } });

const authFail = (res) =>
  res.status(401).json({ success: false, message: "Vendor authentication required." });

const generateBookingNumber = () =>
  `HTL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Ek raat ka rate:  offer > weekend (Fri/Sat) > base */
const nightlyRate = (inv, date) => {
  const day = date.getUTCDay(); // 5 = Fri, 6 = Sat
  if (Number(inv.offerPrice) > 0) return Number(inv.offerPrice);
  if ((day === 5 || day === 6) && Number(inv.weekendPrice) > 0) return Number(inv.weekendPrice);
  return Number(inv.basePrice) || 0;
};

/* ============================================================
   BUILD QUOTE
   Validation + availability check + price calculation.
   - vendorId diya  -> vendor mode (sirf apna hotel/room)
   - vendorId nahi  -> customer mode (public approved hotel)
   - trustAmounts false -> client ke meal/discount/coupon amounts ignore
============================================================ */

const buildQuote = async (body, { vendorId = null, trustAmounts = false } = {}) => {
  const { hotelId, roomId } = body;
  const qty = Number(body.roomsBooked || body.rooms || 1);

  if (!hotelId || !roomId || !body.checkIn || !body.checkOut) {
    return fail(400, "hotelId, roomId, checkIn and checkOut are required.");
  }

  if (!isValidObjectId(hotelId) || !isValidObjectId(roomId)) {
    return fail(400, "Invalid hotelId or roomId.");
  }

  if (!Number.isInteger(qty) || qty < 1) {
    return fail(400, "At least one room must be booked.");
  }
  if (qty > 10) return fail(400, "Maximum 10 rooms per booking.");

  const checkInDate = normalizeDate(body.checkIn);
  const checkOutDate = normalizeDate(body.checkOut);

  if (!checkInDate || !checkOutDate) return fail(400, "Invalid check-in/check-out date.");
  if (checkOutDate <= checkInDate) return fail(400, "Check-out must be after check-in.");
  if (checkInDate < normalizeDate(new Date())) return fail(400, "Check-in date cannot be in the past.");

  const dates = nightList(checkInDate, checkOutDate);
  const nights = dates.length;

  if (nights > 365) return fail(400, "Maximum 365 nights allowed per booking.");

  const hotelFilter = vendorId
    ? { _id: hotelId, vendor: vendorId }
    : { _id: hotelId, status: PUBLIC_HOTEL_STATUS, isActive: { $ne: false } };

  const roomFilter = { _id: roomId, hotel: hotelId, isActive: true };
  if (vendorId) roomFilter.vendor = vendorId;
  else roomFilter.status = { $nin: HIDDEN_ROOM_STATUSES };

  const [hotel, room] = await Promise.all([Hotel.findOne(hotelFilter), HotelRoom.findOne(roomFilter)]);

  if (!hotel) return fail(404, "Hotel not found or not available.");
  if (!room) return fail(404, "Room not found or inactive.");

  /* Guest capacity */
  const adults = Number(body.guest?.adults ?? body.adults ?? 1);
  const children = Number(body.guest?.children ?? body.children ?? 0);

  if (!Number.isInteger(adults) || adults < 1) return fail(400, "At least one adult is required.");
  if (!Number.isInteger(children) || children < 0) return fail(400, "Invalid number of children.");
  if (children > 0 && room.childrenAllowed === false) return fail(400, "Children are not allowed in this room.");

  if (room.maxGuests && adults + children > room.maxGuests * qty) {
    return fail(400, `Maximum ${room.maxGuests * qty} guests allowed for ${qty} room(s) of this type.`);
  }

  /* Inventory (jis date ka record nahi, uske liye room defaults) */
  const inventories = await Promise.all(dates.map((d) => getInventoryOrDefault(room, d)));

  for (const inv of inventories) {
    if (!inv.isActive || inv.stopSell || inv.status !== "OPEN") {
      return fail(409, `Room is not available for ${label(inv.date)}.`);
    }
    if (inv.availableRooms < qty) {
      return fail(409, `Only ${inv.availableRooms} room(s) available on ${label(inv.date)}.`);
    }
  }

  /* Min / max stay (arrival date ke rule se) */
  const rule = inventories[0];
  if (rule.minimumStay && nights < rule.minimumStay) return fail(400, `Minimum stay is ${rule.minimumStay} night(s).`);
  if (rule.maximumStay && nights > rule.maximumStay) return fail(400, `Maximum stay is ${rule.maximumStay} night(s).`);

  /* Price */
  let roomAmount = 0;
  let taxAmount = 0;
  let serviceCharge = 0;
  const nightly = [];

  inventories.forEach((inv, i) => {
    const rate = nightlyRate(inv, dates[i]);
    const amount = rate * qty;

    roomAmount += amount;
    taxAmount += amount * (Number(inv.taxPercentage || 0) / 100);
    serviceCharge += amount * (Number(inv.serviceChargePercentage || 0) / 100);

    nightly.push({ date: label(dates[i]), price: rate, available: inv.availableRooms });
  });

  const pick = (v) => (trustAmounts ? money(v) : 0);
  const extraGuestAmount = pick(body.extraGuestAmount);
  const mealAmount = pick(body.mealAmount);
  const discountAmount = pick(body.discountAmount);
  const couponDiscount = pick(body.couponDiscount);

  const gross = roomAmount + extraGuestAmount + mealAmount + taxAmount + serviceCharge;
  const totalAmount = Math.max(gross - discountAmount - couponDiscount, 0);

  return {
    hotel,
    room,
    vendorId: hotel.vendor,
    qty,
    dates,
    nights,
    checkInDate,
    checkOutDate,
    adults,
    children,
    nightly,
    instant: rule.instantBooking !== false && !room.bookingConfirmationRequired,
    policy: {
      refundable: rule.refundable !== false,
      freeCancellation: !!rule.freeCancellation,
      deadlineHours: rule.cancellationDeadlineHours ?? 24,
      text: rule.cancellationPolicy || room.cancellationPolicy || "",
    },
    minAvailable: Math.min(...inventories.map((i) => i.availableRooms)),
    roomAmount: r2(roomAmount),
    pricePerNight: r2(roomAmount / (nights * qty)),
    extraGuestAmount: r2(extraGuestAmount),
    mealAmount: r2(mealAmount),
    taxAmount: r2(taxAmount),
    serviceCharge: r2(serviceCharge),
    discountAmount: r2(discountAmount),
    couponDiscount: r2(couponDiscount),
    totalAmount: r2(totalAmount),
  };
};

const quoteSummary = (q) => ({
  nights: q.nights,
  rooms: q.qty,
  minAvailable: q.minAvailable,
  pricePerNight: q.pricePerNight,
  roomAmount: q.roomAmount,
  extraGuestAmount: q.extraGuestAmount,
  mealAmount: q.mealAmount,
  taxAmount: q.taxAmount,
  serviceCharge: q.serviceCharge,
  discountAmount: q.discountAmount,
  couponDiscount: q.couponDiscount,
  totalAmount: q.totalAmount,
  instantBooking: q.instant,
  policy: q.policy,
  nightly: q.nightly,
});

/* ############################################################
   PART 1 — PUBLIC  (login ki zarurat nahi)
############################################################ */

/* GET /api/hotel-bookings/public/hotels?city=&q=&hotelType=&page=&limit= */
exports.publicListHotels = async (req, res) => {
  try {
    const { city, q, hotelType, page = 1, limit = 12 } = req.query;

    const query = { status: PUBLIC_HOTEL_STATUS, isActive: { $ne: false } };
    if (city && String(city).trim()) query.city = new RegExp(escapeRegex(String(city).trim()), "i");
    if (hotelType) query.hotelType = String(hotelType);
    if (q && String(q).trim()) {
      const rx = new RegExp(escapeRegex(String(q).trim()), "i");
      query.$or = [{ hotelName: rx }, { city: rx }, { area: rx }, { landmark: rx }];
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);

    const [hotels, total] = await Promise.all([
      Hotel.find(query)
        .select("hotelName hotelType description city state area landmark starRating hotelImages amenities pricePerNight")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Hotel.countDocuments(query),
    ]);

    const ids = hotels.map((h) => h._id);
    const prices = await HotelRoom.aggregate([
      { $match: { hotel: { $in: ids }, isActive: true, status: { $nin: HIDDEN_ROOM_STATUSES } } },
      {
        $group: {
          _id: "$hotel",
          from: { $min: { $cond: [{ $gt: ["$offerPrice", 0] }, "$offerPrice", "$basePrice"] } },
          rooms: { $sum: 1 },
        },
      },
    ]);
    const priceMap = {};
    prices.forEach((p) => { priceMap[String(p._id)] = p; });

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      hotels: hotels.map((h) => ({
        ...h,
        startingPrice: priceMap[String(h._id)]?.from ?? h.pricePerNight ?? null,
        roomCount: priceMap[String(h._id)]?.rooms || 0,
      })),
    });
  } catch (error) {
    console.error("PUBLIC LIST HOTELS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to load hotels." });
  }
};

/* GET /api/hotel-bookings/public/hotels/:hotelId?checkIn=&checkOut=&adults=&children=&rooms= */
exports.publicGetHotel = async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!isValidObjectId(hotelId)) {
      return res.status(400).json({ success: false, message: "Invalid hotel ID." });
    }

    const hotel = await Hotel.findOne({ _id: hotelId, status: PUBLIC_HOTEL_STATUS, isActive: { $ne: false } })
      .select("-vendor -gstNumber")
      .lean();
    if (!hotel) return res.status(404).json({ success: false, message: "Hotel not found." });

    const rooms = await HotelRoom.find({
      hotel: hotelId,
      isActive: true,
      status: { $nin: HIDDEN_ROOM_STATUSES },
    })
      .select("-vendor")
      .sort({ basePrice: 1 })
      .lean();

    const { checkIn, checkOut } = req.query;
    let availability = null;

    if (checkIn && checkOut) {
      availability = {};
      const adults = Number(req.query.adults || 1);
      const children = Number(req.query.children || 0);
      const roomsBooked = Number(req.query.rooms || 1);

      await Promise.all(
        rooms.map(async (r) => {
          const q = await buildQuote({ hotelId, roomId: r._id, checkIn, checkOut, roomsBooked, guest: { adults, children } });
          availability[r._id] = q.error
            ? { available: false, message: q.error.message }
            : {
                available: true,
                nights: q.nights,
                pricePerNight: q.pricePerNight,
                totalAmount: q.totalAmount,
                minAvailable: q.minAvailable,
                instantBooking: q.instant,
              };
        })
      );
    }

    return res.status(200).json({ success: true, hotel, rooms, availability });
  } catch (error) {
    console.error("PUBLIC GET HOTEL ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to load hotel." });
  }
};

/* POST /api/hotel-bookings/public/quote */
exports.publicQuote = async (req, res) => {
  try {
    const q = await buildQuote(req.body);
    if (q.error) return res.status(q.error.status).json({ success: false, message: q.error.message });
    return res.status(200).json({ success: true, quote: quoteSummary(q) });
  } catch (error) {
    console.error("PUBLIC QUOTE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to calculate price." });
  }
};

/* ############################################################
   PART 2 — CUSTOMER  (userAuth -> req.user)
############################################################ */

const CUSTOMER_HIDE = "-razorpaySignature -vendorAmount -adminCommission -commissionPercentage -settlementStatus -settlementId -settledAt -vendorNotes";

/* POST /api/hotel-bookings/customer */
exports.customerCreateBooking = async (req, res) => {
  let deducted = null;

  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Login required." });

    const g = req.body.guest || {};
    const guest = {
      name: String(g.name || req.user.fullname || req.user.name || "").trim(),
      phone: String(g.phone || req.user.phone || "").trim(),
      email: String(g.email || req.user.email || "").trim(),
    };

    if (!guest.name || !guest.phone) {
      return res.status(400).json({ success: false, message: "Guest name and phone are required." });
    }
    if (!/^[0-9+\-\s]{7,15}$/.test(guest.phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number." });
    }
    if (guest.email && !/^\S+@\S+\.\S+$/.test(guest.email)) {
      return res.status(400).json({ success: false, message: "Invalid guest email." });
    }

    const paymentMethod = req.body.paymentMethod || "PAY_AT_HOTEL";
    if (!CUSTOMER_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `Payment method not supported. Allowed: ${CUSTOMER_PAYMENT_METHODS.join(", ")}`,
      });
    }

    const q = await buildQuote(req.body); // customer mode, price server-side
    if (q.error) return res.status(q.error.status).json({ success: false, message: q.error.message });
    if (!q.vendorId) return res.status(500).json({ success: false, message: "Hotel vendor missing." });

    /* Instant booking -> CONFIRMED + inventory kam; warna vendor confirm karega */
    if (q.instant) {
      const result = await deductInventory(q.room, q.dates, q.qty);
      if (!result.ok) return res.status(409).json({ success: false, message: result.message });
      deducted = { room: q.room, dates: q.dates, qty: q.qty };
    }

    const adminCommission = r2((q.totalAmount * COMMISSION_PERCENT) / 100);

    const booking = await HotelBooking.create({
      user: userId,
      hotel: q.hotel._id,
      room: q.room._id,
      vendor: q.vendorId,

      bookingNumber: generateBookingNumber(),

      guest: {
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        alternatePhone: String(g.alternatePhone || ""),
        adults: q.adults,
        children: q.children,
        specialRequest: String(g.specialRequest || "").slice(0, 500),
      },

      checkIn: q.checkInDate,
      checkOut: q.checkOutDate,
      nights: q.nights,
      roomsBooked: q.qty,

      roomName: q.room.roomName || "",
      roomType: q.room.roomType || "",

      pricePerNight: q.pricePerNight,
      roomAmount: q.roomAmount,
      extraGuestAmount: 0,
      mealAmount: 0,
      taxAmount: q.taxAmount,
      serviceCharge: q.serviceCharge,
      discountAmount: 0,
      couponDiscount: 0,
      totalAmount: q.totalAmount,

      paymentMethod,
      paymentStatus: "PENDING",

      bookingStatus: q.instant ? "CONFIRMED" : "PENDING",
      inventoryDeducted: q.instant,

      commissionPercentage: COMMISSION_PERCENT,
      adminCommission,
      vendorAmount: r2(Math.max(q.totalAmount - adminCommission, 0)),

      settlementStatus: "PENDING",
      source: "WEBSITE",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: q.instant ? "Booking confirmed!" : "Booking request sent. The hotel will confirm shortly.",
      booking,
    });
  } catch (error) {
    if (deducted) {
      try {
        await releaseInventory(deducted.room._id, deducted.dates, deducted.qty);
      } catch (e) {
        console.error("ROLLBACK FAILED:", e);
      }
    }
    console.error("CUSTOMER HOTEL BOOKING ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create booking." });
  }
};

/* GET /api/hotel-bookings/customer/my?status=&page=&limit= */
exports.customerMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { user: req.user._id };
    if (status) query.bookingStatus = String(status).toUpperCase();

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const [bookings, total] = await Promise.all([
      HotelBooking.find(query)
        .select(CUSTOMER_HIDE)
        .populate("hotel", "hotelName city state address phone hotelImages checkInTime checkOutTime")
        .populate("room", "roomName roomType images")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      HotelBooking.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, bookings });
  } catch (error) {
    console.error("GET MY BOOKINGS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch bookings." });
  }
};

/* GET /api/hotel-bookings/customer/:bookingId */
exports.customerGetBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID." });
    }

    const booking = await HotelBooking.findOne({ _id: bookingId, user: req.user._id })
      .select(CUSTOMER_HIDE)
      .populate("hotel", "hotelName city state address phone hotelImages checkInTime checkOutTime")
      .populate("room", "roomName roomType images");

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch booking." });
  }
};

/* PUT /api/hotel-bookings/customer/:bookingId/cancel */
exports.customerCancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const reason = String(req.body.reason || "Cancelled by guest").slice(0, 300);

    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID." });
    }

    const booking = await HotelBooking.findOne({ _id: bookingId, user: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    if (!["PENDING", "CONFIRMED"].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Booking cannot be cancelled from ${booking.bookingStatus} status.`,
      });
    }

    const hoursLeft = (booking.checkIn.getTime() - Date.now()) / 36e5;
    if (hoursLeft < -24) {
      return res.status(400).json({ success: false, message: "Stay has already started." });
    }

    /* Refund: paid ho + room me free cancellation ho + deadline se pehle */
    const wasPaid = booking.paymentStatus === "PAID";
    let refundAmount = 0;

    if (wasPaid) {
      const room = await HotelRoom.findById(booking.room).select("refundable freeCancellation cancellationDeadlineHours");
      const deadline = room?.cancellationDeadlineHours ?? 24;
      if (room?.refundable !== false && room?.freeCancellation && hoursLeft >= deadline) {
        refundAmount = booking.totalAmount;
      }
    }

    const original = await HotelBooking.findOneAndUpdate(
      { _id: bookingId, user: req.user._id, bookingStatus: { $in: ["PENDING", "CONFIRMED"] } },
      {
        $set: {
          bookingStatus: "CANCELLED",
          inventoryDeducted: false,
          paymentStatus: wasPaid && refundAmount > 0 ? "REFUNDED" : booking.paymentStatus,
          cancellation: {
            cancelled: true,
            cancelledBy: "GUEST",
            cancelledAt: new Date(),
            reason,
            refundAmount,
          },
        },
      },
      { new: false }
    );

    if (!original) {
      return res.status(409).json({ success: false, message: "Booking status changed, please refresh." });
    }

    if (original.inventoryDeducted) {
      await releaseInventory(original.room, nightList(original.checkIn, original.checkOut), original.roomsBooked);
    }

    const updated = await HotelBooking.findById(bookingId);

    return res.status(200).json({
      success: true,
      message: refundAmount > 0 ? `Booking cancelled. Refund of ₹${refundAmount} will be processed.` : "Booking cancelled.",
      booking: updated,
    });
  } catch (error) {
    console.error("CUSTOMER CANCEL ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel booking." });
  }
};

/* ############################################################
   PART 3 — VENDOR  (protect -> vendor)
############################################################ */

/* POST /api/hotel-bookings/quote  (walk-in booking ke liye) */
exports.quoteBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const q = await buildQuote(req.body, { vendorId, trustAmounts: true });
    if (q.error) {
      return res.status(q.error.status).json({ success: false, message: q.error.message });
    }

    return res.status(200).json({ success: true, quote: quoteSummary(q) });
  } catch (error) {
    console.error("QUOTE HOTEL BOOKING ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to calculate price." });
  }
};

/* POST /api/hotel-bookings  (vendor walk-in booking) */
exports.createBooking = async (req, res) => {
  let deducted = null;

  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const guest = req.body.guest || {};
    const paymentMethod = req.body.paymentMethod || "PAY_AT_HOTEL";

    if (!guest.name || !String(guest.name).trim() || !guest.phone || !String(guest.phone).trim()) {
      return res.status(400).json({ success: false, message: "Guest name and phone are required." });
    }

    if (guest.email && !/^\S+@\S+\.\S+$/.test(guest.email)) {
      return res.status(400).json({ success: false, message: "Invalid guest email." });
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method. Allowed: ${PAYMENT_METHODS.join(", ")}`,
      });
    }

    const q = await buildQuote(req.body, { vendorId, trustAmounts: true });
    if (q.error) {
      return res.status(q.error.status).json({ success: false, message: q.error.message });
    }

    const confirmNow = req.body.confirmNow === undefined ? true : toBool(req.body.confirmNow);

    if (confirmNow) {
      const result = await deductInventory(q.room, q.dates, q.qty);
      if (!result.ok) {
        return res.status(409).json({ success: false, message: result.message });
      }
      deducted = { room: q.room, dates: q.dates, qty: q.qty };
    }

    const paymentStatus = req.body.paymentStatus === "PAID" ? "PAID" : "PENDING";
    const adminCommission = r2((q.totalAmount * COMMISSION_PERCENT) / 100);

    const booking = await HotelBooking.create({
      hotel: q.hotel._id,
      room: q.room._id,
      vendor: vendorId,

      bookingNumber: generateBookingNumber(),

      guest: {
        name: String(guest.name).trim(),
        email: guest.email || "",
        phone: String(guest.phone).trim(),
        alternatePhone: guest.alternatePhone || "",
        adults: q.adults,
        children: q.children,
        specialRequest: guest.specialRequest || "",
      },

      checkIn: q.checkInDate,
      checkOut: q.checkOutDate,
      nights: q.nights,
      roomsBooked: q.qty,

      roomName: q.room.roomName || "",
      roomType: q.room.roomType || "",

      pricePerNight: q.pricePerNight,
      roomAmount: q.roomAmount,
      extraGuestAmount: q.extraGuestAmount,
      mealAmount: q.mealAmount,
      taxAmount: q.taxAmount,
      serviceCharge: q.serviceCharge,
      discountAmount: q.discountAmount,
      couponDiscount: q.couponDiscount,
      couponCode: req.body.couponCode || "",
      totalAmount: q.totalAmount,

      paymentMethod,
      paymentStatus,
      paidAt: paymentStatus === "PAID" ? new Date() : null,

      bookingStatus: confirmNow ? "CONFIRMED" : "PENDING",
      inventoryDeducted: confirmNow,

      commissionPercentage: COMMISSION_PERCENT,
      adminCommission,
      vendorAmount: r2(Math.max(q.totalAmount - adminCommission, 0)),

      settlementStatus: "PENDING",
      source: "VENDOR",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: confirmNow ? "Booking confirmed and inventory updated." : "Booking created as pending.",
      booking,
    });
  } catch (error) {
    if (deducted) {
      try {
        await releaseInventory(deducted.room._id, deducted.dates, deducted.qty);
      } catch (e) {
        console.error("ROLLBACK FAILED:", e);
      }
    }

    console.error("CREATE HOTEL BOOKING ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create hotel booking.",
    });
  }
};

/* GET /api/hotel-bookings   (alias: /vendor) */
exports.getVendorBookings = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { status, paymentStatus, hotelId, search, page = 1, limit = 20 } = req.query;

    const query = { vendor: vendorId };

    if (status) query.bookingStatus = String(status).toUpperCase();
    if (paymentStatus) query.paymentStatus = String(paymentStatus).toUpperCase();
    if (hotelId && isValidObjectId(hotelId)) query.hotel = hotelId;

    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim()), "i");
      query.$or = [{ bookingNumber: rx }, { "guest.name": rx }, { "guest.phone": rx }, { "guest.email": rx }];
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const [bookings, total] = await Promise.all([
      HotelBooking.find(query)
        .populate("hotel", "hotelName city state")
        .populate("room", "roomName roomType")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      HotelBooking.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      bookings,
    });
  } catch (error) {
    console.error("GET HOTEL BOOKINGS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch hotel bookings.", error: error.message });
  }
};

/* GET /api/hotel-bookings/:bookingId */
exports.getSingleBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { bookingId } = req.params;
    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID." });
    }

    const booking = await HotelBooking.findOne({ _id: bookingId, vendor: vendorId })
      .populate("hotel", "hotelName city state phone")
      .populate("room", "roomName roomType");

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch booking.", error: error.message });
  }
};

/* PUT /api/hotel-bookings/:bookingId/confirm   (PENDING -> CONFIRMED, inventory kam) */
exports.confirmBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { bookingId } = req.params;
    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID." });
    }

    const booking = await HotelBooking.findOne({ _id: bookingId, vendor: vendorId });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    if (booking.bookingStatus !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Only pending bookings can be confirmed (current: ${booking.bookingStatus}).`,
      });
    }

    const room = await HotelRoom.findOne({ _id: booking.room, vendor: vendorId });
    if (!room) return res.status(404).json({ success: false, message: "Room not found." });

    const dates = nightList(booking.checkIn, booking.checkOut);

    const result = await deductInventory(room, dates, booking.roomsBooked);
    if (!result.ok) {
      return res.status(409).json({ success: false, message: result.message });
    }

    const updated = await HotelBooking.findOneAndUpdate(
      { _id: bookingId, vendor: vendorId, bookingStatus: "PENDING" },
      { $set: { bookingStatus: "CONFIRMED", inventoryDeducted: true } },
      { new: true }
    );

    if (!updated) {
      await releaseInventory(room._id, dates, booking.roomsBooked);
      return res.status(409).json({ success: false, message: "Booking status changed, please refresh." });
    }

    return res.status(200).json({
      success: true,
      message: "Booking confirmed and inventory updated.",
      booking: updated,
    });
  } catch (error) {
    console.error("CONFIRM BOOKING ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to confirm booking.", error: error.message });
  }
};

/* PUT /api/hotel-bookings/:bookingId/cancel   (inventory wapas) */
exports.cancelBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { bookingId } = req.params;
    const reason = (req.body.reason || "Cancelled by vendor").toString().slice(0, 300);

    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID." });
    }

    const booking = await HotelBooking.findOne({ _id: bookingId, vendor: vendorId });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    if (!["PENDING", "CONFIRMED"].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Booking cannot be cancelled from ${booking.bookingStatus} status.`,
      });
    }

    const wasPaid = booking.paymentStatus === "PAID";

    const original = await HotelBooking.findOneAndUpdate(
      { _id: bookingId, vendor: vendorId, bookingStatus: { $in: ["PENDING", "CONFIRMED"] } },
      {
        $set: {
          bookingStatus: "CANCELLED",
          inventoryDeducted: false,
          paymentStatus: wasPaid ? "REFUNDED" : booking.paymentStatus,
          cancellation: {
            cancelled: true,
            cancelledBy: "VENDOR",
            cancelledAt: new Date(),
            reason,
            refundAmount: wasPaid ? booking.totalAmount : 0,
          },
        },
      },
      { new: false }
    );

    if (!original) {
      return res.status(409).json({ success: false, message: "Booking status changed, please refresh." });
    }

    if (original.inventoryDeducted) {
      await releaseInventory(original.room, nightList(original.checkIn, original.checkOut), original.roomsBooked);
    }

    const updated = await HotelBooking.findById(bookingId);

    return res.status(200).json({
      success: true,
      message: "Booking cancelled and rooms released back to inventory.",
      booking: updated,
    });
  } catch (error) {
    console.error("CANCEL BOOKING ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel booking.", error: error.message });
  }
};

/* PUT /api/hotel-bookings/:bookingId/check-in */
exports.checkIn = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const { idVerified = false, idType = "", idNumber = "", remarks = "" } = req.body;

    const booking = await HotelBooking.findOneAndUpdate(
      { _id: req.params.bookingId, vendor: vendorId, bookingStatus: "CONFIRMED" },
      {
        $set: {
          bookingStatus: "CHECKED_IN",
          "checkInDetails.actualCheckIn": new Date(),
          "checkInDetails.idVerified": toBool(idVerified),
          "checkInDetails.idType": idType,
          "checkInDetails.idNumber": idNumber,
          "checkInDetails.remarks": remarks,
        },
      },
      { new: true }
    );

    if (!booking) {
      return res.status(400).json({ success: false, message: "Only confirmed bookings can be checked in." });
    }

    return res.status(200).json({ success: true, message: "Guest checked in successfully.", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to check in guest.", error: error.message });
  }
};

/* PUT /api/hotel-bookings/:bookingId/check-out */
exports.checkOut = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const booking = await HotelBooking.findOneAndUpdate(
      { _id: req.params.bookingId, vendor: vendorId, bookingStatus: "CHECKED_IN" },
      { $set: { bookingStatus: "CHECKED_OUT", "checkInDetails.actualCheckOut": new Date() } },
      { new: true }
    );

    if (!booking) {
      return res.status(400).json({ success: false, message: "Guest must be checked in first." });
    }

    return res.status(200).json({ success: true, message: "Guest checked out successfully.", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to check out guest.", error: error.message });
  }
};

/* PUT /api/hotel-bookings/:bookingId/payment  (pay-at-hotel / cash) */
exports.markPaid = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return authFail(res);

    const booking = await HotelBooking.findOneAndUpdate(
      {
        _id: req.params.bookingId,
        vendor: vendorId,
        paymentStatus: "PENDING",
        bookingStatus: { $nin: ["CANCELLED", "NO_SHOW"] },
      },
      {
        $set: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          transactionId: req.body.transactionId || "",
        },
      },
      { new: true }
    );

    if (!booking) {
      return res.status(400).json({ success: false, message: "Booking not found or payment already updated." });
    }

    return res.status(200).json({ success: true, message: "Payment marked as paid.", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update payment.", error: error.message });
  }
};