
const mongoose = require("mongoose");
const crypto = require("crypto");

const VillaBooking = require("../models/VillaBooking");
const Villa = require("../models/Villa");
const VillaRoom = require("../models/VillaRoom");

const getVendorId = (req) =>
  req.user?.vendorId ||
  req.vendor?._id ||
  req.user?.id ||
  req.user?._id;

const validId = (id) => mongoose.isValidObjectId(id);

const parseDate = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
};

const makeReference = () =>
  `VIL-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const getNights = (checkIn, checkOut) =>
  Math.round((checkOut - checkIn) / 86400000);

// POST /api/vendor/villas/:villaId/rooms/:roomId/bookings
exports.createVillaBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { villaId, roomId } = req.params;

    if (!vendorId || !validId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required.",
      });
    }

    if (!validId(villaId) || !validId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid villaId or roomId.",
      });
    }

    const {
      guest,
      checkIn: checkInValue,
      checkOut: checkOutValue,
      adults = 1,
      children = 0,
      roomsBooked = 1,
      paymentMethod = "pay-at-property",
      specialRequests = "",
    } = req.body;

    const checkIn = parseDate(checkInValue);
    const checkOut = parseDate(checkOutValue);

    if (
      !checkIn ||
      !checkOut ||
      checkOut <= checkIn ||
      !Number.isInteger(adults) ||
      adults < 1 ||
      !Number.isInteger(children) ||
      children < 0 ||
      !Number.isInteger(roomsBooked) ||
      roomsBooked < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid dates, guest count and room quantity are required.",
      });
    }

    if (
      !guest?.name?.trim() ||
      !guest?.email?.trim() ||
      !guest?.phone?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Guest name, email and phone are required.",
      });
    }

    if (!["online", "pay-at-property"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method.",
      });
    }

    const villa = await Villa.findOne({
      _id: villaId,
      vendor: vendorId,
    });

    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found for this vendor.",
      });
    }

    const room = await VillaRoom.findOne({
      _id: roomId,
      villa: villaId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found in this villa.",
      });
    }

    const maxGuests = Number(room.maxGuests || villa.maxGuests || 1);

    if (adults + children > maxGuests) {
      return res.status(400).json({
        success: false,
        message: `This room supports a maximum of ${maxGuests} guests.`,
      });
    }

    // Use the room's configured base price for this basic version.
    const pricePerNight = Number(room.pricePerNight ?? villa.pricePerNight);

    if (!Number.isFinite(pricePerNight) || pricePerNight < 0) {
      return res.status(400).json({
        success: false,
        message: "Room pricing is not configured correctly.",
      });
    }

    const nights = getNights(checkIn, checkOut);
    const subtotal = pricePerNight * nights * roomsBooked;

    const booking = await VillaBooking.create({
      bookingReference: makeReference(),
      villaId,
      roomId,
      vendorId,
      customerId: req.user?._id || req.user?.id || null,
      guest: {
        name: guest.name.trim(),
        email: guest.email.trim().toLowerCase(),
        phone: guest.phone.trim(),
      },
      checkIn,
      checkOut,
      adults,
      children,
      roomsBooked,
      pricePerNight,
      nights,
      subtotal,
      taxes: 0,
      totalAmount: subtotal,
      paymentMethod,
      paymentStatus: "pending",
      bookingStatus: "pending",
      specialRequests: String(specialRequests || "").trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      booking,
    });
  } catch (error) {
    console.error("createVillaBooking:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create villa booking.",
    });
  }
};

// GET /api/vendor/villas/bookings
exports.getVendorVillaBookings = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId || !validId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication is required.",
      });
    }

    const { status, from, to } = req.query;
    const filter = { vendorId };

    if (status) {
      const allowed = [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
      ];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking status.",
        });
      }

      filter.bookingStatus = status;
    }

    if (from || to) {
      const start = parseDate(from);
      const end = parseDate(to);

      if ((from && !start) || (to && !end) || (start && end && start > end)) {
        return res.status(400).json({
          success: false,
          message: "Invalid from/to date range.",
        });
      }

      filter.checkIn = {};
      if (start) filter.checkIn.$gte = start;
      if (end) filter.checkIn.$lte = end;
    }

    const bookings = await VillaBooking.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("getVendorVillaBookings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings.",
    });
  }
};

// GET /api/vendor/villas/bookings/:bookingId
exports.getVillaBookingById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { bookingId } = req.params;

    if (!vendorId || !validId(vendorId) || !validId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Valid vendor and booking IDs are required.",
      });
    }

    const booking = await VillaBooking.findOne({
      _id: bookingId,
      vendorId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    return res.json({ success: true, booking });
  } catch (error) {
    console.error("getVillaBookingById:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking.",
    });
  }
};

// PATCH /api/vendor/villas/bookings/:bookingId/cancel
exports.cancelVillaBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { bookingId } = req.params;

    if (!vendorId || !validId(vendorId) || !validId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Valid vendor and booking IDs are required.",
      });
    }

    const booking = await VillaBooking.findOne({
      _id: bookingId,
      vendorId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (["cancelled", "completed"].includes(booking.bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: "This booking cannot be cancelled.",
      });
    }

    booking.bookingStatus = "cancelled";
    booking.cancellationReason = String(
      req.body?.reason || "Cancelled by vendor"
    ).trim();
    booking.cancelledAt = new Date();

    await booking.save();

    return res.json({
      success: true,
      message: "Booking cancelled.",
      booking,
    });
  } catch (error) {
    console.error("cancelVillaBooking:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking.",
    });
  }
};
