const mongoose = require("mongoose");

/* ==========================================================
                    GUEST SUB-SCHEMA
========================================================== */

const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    age: { type: Number, default: null },
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
      default: "OTHER",
    },
  },
  { _id: false }
);

/* ==========================================================
                    PAYMENT SUB-SCHEMA
========================================================== */

const paymentEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["ONLINE", "CASH", "CARD", "UPI", "BANK_TRANSFER"],
      default: "CASH",
    },
    note: { type: String, default: "", trim: true },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/* ==========================================================
                    BOOKING SCHEMA
========================================================== */

const resortBookingSchema = new mongoose.Schema(
  {
    // ---------- BOOKING NUMBER ----------
    bookingId: {
      type: String,
      unique: true,
      required: true,
    },

    // ---------- VENDOR / RESORT ----------
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    customer: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
  index: true,
},

    resort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resort",
      required: true,
      index: true,
    },

    // ---------- ROOM DETAILS ----------
    roomCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResortRoom",
      required: true,
    },

    ratePlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResortRatePlan",
      required: true,
    },

    roomUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResortRoomUnit",
      default: null,
      index: true,
    },

    // ---------- STAY DATES ----------
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    totalNights: { type: Number, required: true, min: 1 },

    // ---------- GUEST COUNT ----------
    rooms: { type: Number, default: 1, min: 1 },
    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, default: 0, min: 0 },

    // ---------- GUESTS ----------
    leadGuest: { type: guestSchema, required: true },
    additionalGuests: { type: [guestSchema], default: [] },

    // ---------- PRICE BREAKDOWN ----------
    pricing: {
      roomPrice: { type: Number, default: 0 },
      extraAdultAmount: { type: Number, default: 0 },
      extraChildAmount: { type: Number, default: 0 },
      gstAmount: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
    },

    // ---------- BOOKING STATUS ----------
    bookingStatus: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "CHECKED_IN",
        "CHECKED_OUT",
        "CANCELLED",
        "NO_SHOW",
      ],
      default: "PENDING",
      index: true,
    },

    // ---------- PAYMENT ----------
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["ONLINE", "CASH", "CARD", "UPI", "BANK_TRANSFER"],
      default: "ONLINE",
    },

    paidAmount: { type: Number, default: 0, min: 0 },
    refundAmount: { type: Number, default: 0, min: 0 },

    payments: { type: [paymentEntrySchema], default: [] },

    // ---------- PAYMENT GATEWAY ----------
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },

    // ---------- BOOKING SOURCE ----------
    bookingSource: {
      type: String,
      enum: ["VENDOR_PANEL", "WEBSITE", "MOBILE_APP", "ADMIN", "OFFLINE"],
      default: "VENDOR_PANEL",
    },

    // ---------- NOTES ----------
    specialRequest: { type: String, default: "", trim: true },
    internalNotes: { type: String, default: "", trim: true },

    // ---------- INVENTORY TRACKING ----------
    // true => inventory is currently released back (cancelled / no-show)
    inventoryReleased: { type: Boolean, default: false },

    // ---------- CANCELLATION ----------
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "" },
    cancelledBy: {
      type: String,
      enum: ["USER", "VENDOR", "ADMIN", ""],
      default: "",
    },

    // ---------- CHECK-IN / CHECK-OUT TIMESTAMPS ----------
    checkedInAt: { type: Date, default: null },
    checkedOutAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ==========================================================
                    INDEXES
========================================================== */

resortBookingSchema.index({ vendor: 1, bookingStatus: 1, checkIn: 1 });
resortBookingSchema.index({ vendor: 1, createdAt: -1 });
resortBookingSchema.index({ resort: 1, checkIn: 1, checkOut: 1 });
resortBookingSchema.index({ "leadGuest.phone": 1 });

module.exports =
  mongoose.models.ResortBooking ||
  mongoose.model("ResortBooking", resortBookingSchema);