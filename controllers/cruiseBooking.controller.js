const mongoose = require("mongoose");
const crypto = require("crypto");

const CruiseBooking = require("../models/CruiseBooking.model");
const CruiseAvailability = require("../models/CruiseAvailability.model");
const CruisePricing = require("../models/CruisePricing.model");

/* ==========================================================
   COMMON HELPERS
========================================================== */

// Customer: userAuth middleware req.user attach karta hai
const getCustomerId = (req) => req.user?._id || req.user?.id || req.user?.userId;

// Vendor: auth.middleware.js jo bhi attach kare (req.vendor ya req.user)
const getVendorId = (req) =>
  req.vendor?._id ||
  req.vendor?.id ||
  req.user?._id ||
  req.user?.id ||
  req.user?.userId ||
  req.vendorId;

const generateBookingReference = () => {
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `CR-${Date.now().toString().slice(-8)}-${random}`;
};

const withRelations = (query) =>
  query
    .populate("sailingId")
    .populate("shipId", "shipName cruiseLineName cruiseType")
    .populate("cabinId")
    .populate("pricingId");

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const serverError = (res, label, message, error) => {
  console.error(`${label}:`, error);
  return fail(res, 500, message, { error: error.message });
};

/*
  Inventory sync (document load + save(), taaki pre("validate") hook chale
  aur availability ka status available / limited / sold-out sahi update ho).

  "confirm": reserved -> sold
  "release": booking ki inventory wapas available mein
*/
const syncAvailability = async (booking, mode) => {
  const availability = await CruiseAvailability.findOne({
    vendorId: booking.vendorId,
    sailingId: booking.sailingId,
    cabinId: booking.cabinId,
  });

  if (!availability) return;

  const qty = Number(booking.quantity) || 0;
  if (qty <= 0) return;

  if (mode === "confirm") {
    if (availability.reservedInventory >= qty) {
      availability.reservedInventory -= qty;
      availability.soldInventory += qty;
      await availability.save();
    }
    return;
  }

  if (mode === "release") {
    if (booking.bookingStatus === "reserved") {
      if (availability.reservedInventory >= qty) {
        availability.reservedInventory -= qty;
        availability.availableInventory += qty;
        await availability.save();
      }
      return;
    }

    if (booking.bookingStatus === "confirmed") {
      if (availability.soldInventory >= qty) {
        availability.soldInventory -= qty;
        availability.availableInventory += qty;
        await availability.save();
      } else if (availability.reservedInventory >= qty) {
        availability.reservedInventory -= qty;
        availability.availableInventory += qty;
        await availability.save();
      }
    }
  }
};

/* ==========================================================
   CUSTOMER  (/api/customer/cruise-bookings)
========================================================== */

/* POST / */
const createCruiseBooking = async (req, res) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) return fail(res, 401, "Customer authentication required.");

    const {
      sailingId,
      shipId,
      cabinId,
      pricingId,
      customerName,
      customerEmail,
      customerPhone,
      passengers,
      quantity = 1,
      specialRequests = "",
    } = req.body;

    if (!sailingId) return fail(res, 400, "Sailing ID is required.");
    if (!shipId) return fail(res, 400, "Ship ID is required.");
    if (!cabinId) return fail(res, 400, "Cabin ID is required.");
    if (!pricingId) return fail(res, 400, "Pricing ID is required.");
    if (!customerName) return fail(res, 400, "Customer name is required.");
    if (!customerEmail) return fail(res, 400, "Customer email is required.");
    if (!customerPhone) return fail(res, 400, "Customer phone is required.");

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return fail(res, 400, "At least one passenger is required.");
    }

    const bookingQuantity = Number(quantity);

    if (!Number.isInteger(bookingQuantity) || bookingQuantity < 1) {
      return fail(res, 400, "Quantity must be a positive integer.");
    }

    if (passengers.length !== bookingQuantity) {
      return fail(res, 400, "Passenger count must match booking quantity.");
    }

    const pricing = await CruisePricing.findOne({
      _id: pricingId,
      sailingId,
      shipId,
      cabinId,
    });

    if (!pricing) return fail(res, 404, "Valid cruise pricing not found.");
    if (pricing.status !== "active") {
      return fail(res, 400, "Selected cruise pricing is not active.");
    }

    const pricePerPassenger = Number(
      pricing.finalPrice ??
        pricing.totalPrice ??
        pricing.adultPrice ??
        pricing.basePrice ??
        0
    );

    if (pricePerPassenger <= 0) {
      return fail(res, 400, "Invalid cruise pricing amount.");
    }

    const baseAmount = pricePerPassenger * bookingQuantity;
    const taxAmount = Number(pricing.taxAmount || 0) * bookingQuantity;
    const portCharges = Number(pricing.portCharges || 0) * bookingQuantity;
    const serviceCharges = Number(pricing.serviceCharges || 0) * bookingQuantity;
    const discountAmount = Number(pricing.discountAmount || 0) * bookingQuantity;

    const totalAmount = Math.max(
      0,
      baseAmount + taxAmount + portCharges + serviceCharges - discountAmount
    );

    // Inventory reserve (atomic)
    const availability = await CruiseAvailability.findOneAndUpdate(
      {
        sailingId,
        shipId,
        cabinId,
        availableInventory: { $gte: bookingQuantity },
        status: { $in: ["available", "limited"] },
      },
      {
        $inc: {
          availableInventory: -bookingQuantity,
          reservedInventory: bookingQuantity,
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!availability) {
      return fail(res, 409, "Not enough cabin availability for this booking.");
    }

    // Availability ka status (limited / sold-out) refresh
    try {
      await availability.save();
    } catch (statusError) {
      console.error("AVAILABILITY STATUS REFRESH ERROR:", statusError.message);
    }

    let booking;

    try {
      booking = await CruiseBooking.create({
        bookingReference: generateBookingReference(),
        customerId,
        vendorId: availability.vendorId,

        sailingId,
        shipId,
        cabinId,
        pricingId,

        customerName,
        customerEmail: customerEmail.toLowerCase().trim(),
        customerPhone,

        passengers,
        quantity: bookingQuantity,

        currency: pricing.currency || "INR",

        baseAmount,
        taxAmount,
        portCharges,
        serviceCharges,
        discountAmount,
        totalAmount,

        paymentStatus: "pending",
        bookingStatus: "reserved",
        paymentMethod: "razorpay",

        specialRequests,
      });
    } catch (bookingError) {
      // Booking fail hui to reserved inventory wapas
      await CruiseAvailability.findOneAndUpdate(
        { _id: availability._id, reservedInventory: { $gte: bookingQuantity } },
        {
          $inc: {
            availableInventory: bookingQuantity,
            reservedInventory: -bookingQuantity,
          },
        }
      );
      throw bookingError;
    }

    return res.status(201).json({
      success: true,
      message: "Cruise booking created successfully.",
      booking,
    });
  } catch (error) {
    console.error("CREATE CRUISE BOOKING ERROR:", error);

    if (error.code === 11000) {
      return fail(res, 409, "Booking reference already exists. Please try again.");
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return fail(res, 400, "Booking validation failed.", { error: error.message });
    }

    return fail(res, 500, "Failed to create cruise booking.", { error: error.message });
  }
};

/* GET / */
const getMyCruiseBookings = async (req, res) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) return fail(res, 401, "Customer authentication required.");

    const bookings = await withRelations(
      CruiseBooking.find({ customerId })
        .populate("vendorId", "name email phone")
        .sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    return serverError(res, "GET MY CRUISE BOOKINGS ERROR", "Failed to fetch cruise bookings.", error);
  }
};

/* GET /:id */
const getCruiseBookingById = async (req, res) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) return fail(res, 401, "Customer authentication required.");

    const booking = await withRelations(
      CruiseBooking.findOne({ _id: req.params.id, customerId }).populate(
        "vendorId",
        "name email phone"
      )
    );

    if (!booking) return fail(res, 404, "Cruise booking not found.");

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return serverError(res, "GET CRUISE BOOKING ERROR", "Failed to fetch cruise booking.", error);
  }
};

/* PATCH /:id/cancel */
const cancelCruiseBooking = async (req, res) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) return fail(res, 401, "Customer authentication required.");

    const booking = await CruiseBooking.findOne({ _id: req.params.id, customerId });

    if (!booking) return fail(res, 404, "Cruise booking not found.");

    if (["cancelled", "completed"].includes(booking.bookingStatus)) {
      return fail(
        res,
        400,
        `Booking cannot be cancelled because it is already ${booking.bookingStatus}.`
      );
    }

    if (booking.paymentStatus === "paid") {
      return fail(
        res,
        400,
        "Paid booking cancellation should be processed through the refund flow."
      );
    }

    // Status badalne se PEHLE inventory release
    await syncAvailability(booking, "release");

    booking.bookingStatus = "cancelled";
    booking.cancellationReason = req.body?.reason || "";
    booking.cancelledAt = new Date();
    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Cruise booking cancelled successfully.",
      booking,
    });
  } catch (error) {
    return serverError(res, "CANCEL CRUISE BOOKING ERROR", "Failed to cancel cruise booking.", error);
  }
};

/* ==========================================================
   VENDOR  (/api/vendor/cruise-bookings)
========================================================== */

/* GET / */
const getVendorCruiseBookings = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required.");

    const bookings = await withRelations(
      CruiseBooking.find({ vendorId }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    return serverError(res, "GET VENDOR CRUISE BOOKINGS ERROR", "Failed to fetch cruise bookings.", error);
  }
};

/* GET /:id */
const getVendorCruiseBookingById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required.");

    const booking = await withRelations(
      CruiseBooking.findOne({ _id: req.params.id, vendorId })
    );

    if (!booking) return fail(res, 404, "Cruise booking not found.");

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return serverError(res, "GET VENDOR CRUISE BOOKING ERROR", "Failed to fetch cruise booking.", error);
  }
};

/* PATCH /:id/confirm */
const confirmCruiseBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required.");

    const booking = await CruiseBooking.findOne({ _id: req.params.id, vendorId });

    if (!booking) return fail(res, 404, "Cruise booking not found.");

    if (!["pending", "reserved"].includes(booking.bookingStatus)) {
      return fail(
        res,
        400,
        `Only pending or reserved bookings can be confirmed. Current status: ${booking.bookingStatus}.`
      );
    }

    if (booking.bookingStatus === "reserved") {
      await syncAvailability(booking, "confirm");
    }

    booking.bookingStatus = "confirmed";
    booking.confirmedAt = new Date();
    await booking.save();

    const populated = await withRelations(CruiseBooking.findById(booking._id));

    return res.status(200).json({
      success: true,
      message: "Cruise booking confirmed.",
      booking: populated,
    });
  } catch (error) {
    return serverError(res, "CONFIRM CRUISE BOOKING ERROR", "Failed to confirm cruise booking.", error);
  }
};

/* PATCH /:id/complete */
const completeCruiseBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required.");

    const booking = await CruiseBooking.findOne({ _id: req.params.id, vendorId });

    if (!booking) return fail(res, 404, "Cruise booking not found.");

    if (booking.bookingStatus !== "confirmed") {
      return fail(
        res,
        400,
        `Only confirmed bookings can be completed. Current status: ${booking.bookingStatus}.`
      );
    }

    booking.bookingStatus = "completed";
    booking.completedAt = new Date();
    await booking.save();

    const populated = await withRelations(CruiseBooking.findById(booking._id));

    return res.status(200).json({
      success: true,
      message: "Cruise booking marked as completed.",
      booking: populated,
    });
  } catch (error) {
    return serverError(res, "COMPLETE CRUISE BOOKING ERROR", "Failed to complete cruise booking.", error);
  }
};

/* PATCH /:id/cancel */
const cancelVendorCruiseBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required.");

    const booking = await CruiseBooking.findOne({ _id: req.params.id, vendorId });

    if (!booking) return fail(res, 404, "Cruise booking not found.");

    if (["cancelled", "completed"].includes(booking.bookingStatus)) {
      return fail(
        res,
        400,
        `Booking cannot be cancelled because it is already ${booking.bookingStatus}.`
      );
    }

    // Status badalne se PEHLE inventory release
    await syncAvailability(booking, "release");

    const wasPaid = booking.paymentStatus === "paid";

    booking.bookingStatus = "cancelled";
    booking.cancellationReason = req.body?.reason || "Cancelled by vendor";
    booking.cancelledAt = new Date();
    await booking.save();

    const populated = await withRelations(CruiseBooking.findById(booking._id));

    return res.status(200).json({
      success: true,
      message: wasPaid
        ? "Booking cancelled. Payment was already received, please process the refund."
        : "Cruise booking cancelled successfully.",
      booking: populated,
    });
  } catch (error) {
    return serverError(res, "CANCEL VENDOR CRUISE BOOKING ERROR", "Failed to cancel cruise booking.", error);
  }
};

module.exports = {
  // customer
  createCruiseBooking,
  getMyCruiseBookings,
  getCruiseBookingById,
  cancelCruiseBooking,
  // vendor
  getVendorCruiseBookings,
  getVendorCruiseBookingById,
  confirmCruiseBooking,
  completeCruiseBooking,
  cancelVendorCruiseBooking,
};