const mongoose = require("mongoose");

const hotelBookingSchema = new mongoose.Schema(
  {
    /* REFERENCES */
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "HotelRoom", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    /* Customer jisne booking ki (vendor walk-in booking me null) */
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    /* BOOKING NUMBER (unique already index banata hai) */
    bookingNumber: { type: String, required: true, unique: true },

    /* GUEST */
    guest: {
      name: { type: String, required: true, trim: true },
      email: { type: String, default: "", lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
      alternatePhone: { type: String, default: "" },
      adults: { type: Number, required: true, min: 1 },
      children: { type: Number, default: 0, min: 0 },
      specialRequest: { type: String, default: "" },
    },

    /* STAY (dates UTC midnight) */
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    nights: { type: Number, required: true, min: 1 },
    roomsBooked: { type: Number, required: true, min: 1 },

    /* ROOM SNAPSHOT */
    roomName: { type: String, default: "" },
    roomType: { type: String, default: "" },

    /* PRICING */
    pricePerNight: { type: Number, required: true, min: 0 },
    roomAmount: { type: Number, required: true, min: 0 },
    extraGuestAmount: { type: Number, default: 0, min: 0 },
    mealAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    couponDiscount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    couponCode: { type: String, default: "", uppercase: true, trim: true },

    /* PAYMENT */
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "UPI", "CARD", "NET_BANKING", "PAY_AT_HOTEL", "CASH"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
      default: "PENDING",
      index: true,
    },
    transactionId: { type: String, default: "" },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },
    paidAt: { type: Date, default: null },

    /* BOOKING STATUS */
    bookingStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW", "COMPLETED"],
      default: "PENDING",
      index: true,
    },

    /* Inventory se rooms kam ho chuke hain ya nahi (double deduct / double release se bachata hai) */
    inventoryDeducted: { type: Boolean, default: false },

    /* CANCELLATION */
    cancellation: {
      cancelled: { type: Boolean, default: false },
      cancelledBy: { type: String, enum: ["GUEST", "VENDOR", "ADMIN", ""], default: "" },
      cancelledAt: { type: Date, default: null },
      reason: { type: String, default: "" },
      refundAmount: { type: Number, default: 0 },
    },

    /* COMMISSION */
    commissionPercentage: { type: Number, default: 0, min: 0 },
    adminCommission: { type: Number, default: 0, min: 0 },
    vendorAmount: { type: Number, default: 0, min: 0 },

    /* SETTLEMENT */
    settlementStatus: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SETTLED", "FAILED"],
      default: "PENDING",
    },
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "HotelSettlement", default: null },
    settledAt: { type: Date, default: null },

    /* CHECK-IN DETAILS */
    checkInDetails: {
      actualCheckIn: { type: Date, default: null },
      actualCheckOut: { type: Date, default: null },
      idVerified: { type: Boolean, default: false },
      idType: { type: String, default: "" },
      idNumber: { type: String, default: "" },
      remarks: { type: String, default: "" },
    },

    vendorNotes: { type: String, default: "" },

    source: {
      type: String,
      enum: ["WEBSITE", "MOBILE_APP", "ADMIN", "VENDOR"],
      default: "WEBSITE",
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

hotelBookingSchema.index({ vendor: 1, bookingStatus: 1 });
hotelBookingSchema.index({ user: 1, createdAt: -1 });
hotelBookingSchema.index({ hotel: 1, checkIn: 1, checkOut: 1 });
hotelBookingSchema.index({ room: 1, checkIn: 1, checkOut: 1 });
hotelBookingSchema.index({ paymentStatus: 1, settlementStatus: 1 });

module.exports =
  mongoose.models.HotelBooking ||
  mongoose.model("HotelBooking", hotelBookingSchema);