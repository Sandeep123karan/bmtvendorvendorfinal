
const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    adults: { type: Number, default: 1, min: 1 },
    children: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const palaceBookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    palace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Palace",
      required: true,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    roomCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PalaceRoomCategory",
      required: true,
    },
    ratePlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PalaceRatePlan",
      default: null,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    guest: { type: guestSchema, required: true },

    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    nights: { type: Number, required: true, min: 1 },
    rooms: { type: Number, required: true, min: 1 },
    specialRequests: { type: String, default: "", trim: true },

    pricing: {
      roomAmount: { type: Number, required: true, min: 0 },
      discountAmount: { type: Number, default: 0, min: 0 },
      taxAmount: { type: Number, default: 0, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: "INR" },
    },

    payment: {
      method: {
        type: String,
        enum: ["CASH", "ONLINE", "UPI", "CARD", "OTHER"],
        default: "OTHER",
      },
      status: {
        type: String,
        enum: [
          "PENDING",
          "PAID",
          "PARTIAL",
          "FAILED",
          "REFUNDED",
        ],
        default: "PENDING",
        index: true,
      },
      paidAmount: { type: Number, default: 0, min: 0 },
      transactionId: { type: String, default: "" },
      gatewayOrderId: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "CHECKED_IN",
        "CHECKED_OUT",
        "CANCELLED",
        "REJECTED",
      ],
      default: "PENDING",
      index: true,
    },

    vendorNote: { type: String, default: "", trim: true },
    cancellationReason: { type: String, default: "", trim: true },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

palaceBookingSchema.index({
  vendor: 1,
  status: 1,
  createdAt: -1,
});

palaceBookingSchema.index({
  palace: 1,
  checkIn: 1,
  checkOut: 1,
});

module.exports =
  mongoose.models.PalaceBooking ||
  mongoose.model("PalaceBooking", palaceBookingSchema);
