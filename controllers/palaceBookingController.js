
const mongoose = require("mongoose");
const PalaceBooking = require("../models/PalaceBooking.model");
const Palace = require("../models/Palace.model");

const getVendorId = (req) =>
  req.vendor?._id ||
  req.vendor?.id ||
  req.user?.vendorId ||
  req.user?._id ||
  req.user?.id ||
  null;

const validId = (id) => mongoose.isValidObjectId(id);

const getOwnedBooking = async (bookingId, vendorId) => {
  if (!validId(bookingId)) return null;

  return PalaceBooking.findOne({
    _id: bookingId,
    vendor: vendorId,
  })
    .populate("palace", "propertyName")
    .populate("roomCategory", "name")
    .populate("ratePlan", "name displayName");
};

// GET /api/palace-bookings/vendor
exports.getVendorBookings = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    const {
      status,
      paymentStatus,
      palaceId,
      search,
      from,
      to,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { vendor: vendorId };

    if (status) filter.status = status;
    if (paymentStatus) filter["payment.status"] = paymentStatus;

    if (palaceId) {
      if (!validId(palaceId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid palaceId",
        });
      }
      filter.palace = palaceId;
    }

    if (from || to) {
      filter.checkIn = {};
      if (from) filter.checkIn.$gte = new Date(from);
      if (to) filter.checkIn.$lte = new Date(to);

      if (
        (from && Number.isNaN(new Date(from).getTime())) ||
        (to && Number.isNaN(new Date(to).getTime()))
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid date filter",
        });
      }
    }

    if (search) {
      const regex = new RegExp(
        String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      filter.$or = [
        { bookingReference: regex },
        { "guest.name": regex },
        { "guest.email": regex },
        { "guest.phone": regex },
      ];
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const [bookings, total] = await Promise.all([
      PalaceBooking.find(filter)
        .populate("palace", "propertyName")
        .populate("roomCategory", "name")
        .populate("ratePlan", "name displayName")
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      PalaceBooking.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: bookings,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    console.error("GET PALACE BOOKINGS:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
};

// GET /api/palace-bookings/vendor/:id
exports.getVendorBookingById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    const booking = await getOwnedBooking(req.params.id, vendorId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error("GET PALACE BOOKING:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
    });
  }
};

// PATCH /api/palace-bookings/vendor/:id/status
exports.updateVendorBookingStatus = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    const allowedStatuses = [
      "CONFIRMED",
      "REJECTED",
      "CHECKED_IN",
      "CHECKED_OUT",
      "CANCELLED",
    ];

    const { status, cancellationReason } = req.body;
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
      });
    }

    const booking = await PalaceBooking.findOne({
      _id: req.params.id,
      vendor: vendorId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const transitions = {
      PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
      CONFIRMED: ["CHECKED_IN", "CANCELLED"],
      CHECKED_IN: ["CHECKED_OUT"],
      CHECKED_OUT: [],
      CANCELLED: [],
      REJECTED: [],
    };

    if (!transitions[booking.status]?.includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change booking from ${booking.status} to ${status}`,
      });
    }

    if (
      ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(status) &&
      booking.payment.status === "FAILED"
    ) {
      return res.status(409).json({
        success: false,
        message: "Failed payment booking cannot be confirmed or checked in",
      });
    }

    booking.status = status;

    if (status === "CANCELLED" || status === "REJECTED") {
      booking.cancellationReason = String(cancellationReason || "").trim();
      booking.cancelledAt = new Date();
    }

    await booking.save();

    return res.json({
      success: true,
      message: "Booking status updated",
      data: booking,
    });
  } catch (error) {
    console.error("UPDATE PALACE BOOKING STATUS:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update booking status",
    });
  }
};

// PATCH /api/palace-bookings/vendor/:id/note
exports.updateVendorBookingNote = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    if (typeof req.body.note !== "string") {
      return res.status(400).json({
        success: false,
        message: "note must be a string",
      });
    }

    const booking = await PalaceBooking.findOneAndUpdate(
      { _id: req.params.id, vendor: vendorId },
      { $set: { vendorNote: req.body.note.trim().slice(0, 2000) } },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.json({
      success: true,
      message: "Vendor note updated",
      data: booking,
    });
  } catch (error) {
    console.error("UPDATE PALACE BOOKING NOTE:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update note",
    });
  }
};

// GET /api/palace-bookings/vendor/analytics/summary
exports.getVendorBookingSummary = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required",
      });
    }

    const [statusCounts, paymentCounts, revenue] = await Promise.all([
      PalaceBooking.aggregate([
        { $match: { vendor: new mongoose.Types.ObjectId(String(vendorId)) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      PalaceBooking.aggregate([
        { $match: { vendor: new mongoose.Types.ObjectId(String(vendorId)) } },
        { $group: { _id: "$payment.status", count: { $sum: 1 } } },
      ]),
      PalaceBooking.aggregate([
        {
          $match: {
            vendor: new mongoose.Types.ObjectId(String(vendorId)),
            "payment.status": { $in: ["PAID", "PARTIAL"] },
            status: { $nin: ["CANCELLED", "REJECTED"] },
          },
        },
        {
          $group: {
            _id: null,
            bookings: { $sum: 1 },
            totalBookingValue: { $sum: "$pricing.totalAmount" },
            collectedAmount: { $sum: "$payment.paidAmount" },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        bookingsByStatus: Object.fromEntries(
          statusCounts.map((item) => [item._id, item.count])
        ),
        paymentsByStatus: Object.fromEntries(
          paymentCounts.map((item) => [item._id, item.count])
        ),
        revenue: revenue[0] || {
          bookings: 0,
          totalBookingValue: 0,
          collectedAmount: 0,
        },
      },
    });
  } catch (error) {
    console.error("PALACE BOOKING SUMMARY:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to calculate booking summary",
    });
  }
};
