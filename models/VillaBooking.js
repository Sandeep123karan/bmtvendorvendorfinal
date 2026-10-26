
const mongoose = require("mongoose");

const villaBookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    villaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Villa",
      required: true,
      index: true,
    },

    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    guest: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
    },

    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },

    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, default: 0, min: 0 },
    roomsBooked: { type: Number, default: 1, min: 1 },

    pricePerNight: { type: Number, required: true, min: 0 },
    nights: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    taxes: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    paymentMethod: {
      type: String,
      enum: ["online", "pay-at-property"],
      default: "pay-at-property",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    bookingStatus: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
      index: true,
    },

    cancellationReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    specialRequests: { type: String, default: "" },
  },
  { timestamps: true }
);

villaBookingSchema.index({
  vendorId: 1,
  bookingStatus: 1,
  checkIn: 1,
});

module.exports = mongoose.model("VillaBooking", villaBookingSchema);
