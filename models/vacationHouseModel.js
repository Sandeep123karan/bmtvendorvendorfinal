const mongoose = require("mongoose");

const vacationHouseSchema = new mongoose.Schema(
  {
    /* ===== BASIC INFO ===== */
    propertyName: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    starRating: { type: Number, min: 1, max: 5 },

    /* ===== LOCATION ===== */
    address: {
      street: { type: String, default: "" },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, default: "" },
      latitude: Number,
      longitude: Number,
    },

    /* ===== OWNER ===== */
    owner: {
      ownerName: String,
      phone: String,
      alternatePhone: { type: String, default: "" },
      email: { type: String, default: "" },
    },

    /* ===== PRICING ===== */
    pricing: {
      basePrice: { type: Number, min: 0 },
      weekendPrice: { type: Number, min: 0 },
      monthlyPrice: { type: Number, min: 0 },
      cleaningFee: { type: Number, min: 0 },
      securityDeposit: { type: Number, min: 0 },
    },

    /* ===== RULES ===== */
    checkInTime: { type: String, default: "" },
    checkOutTime: { type: String, default: "" },
    petsAllowed: { type: Boolean, default: false },
    smokingAllowed: { type: Boolean, default: false },
    cancellationPolicy: { type: String, default: "" },
    houseRules: { type: String, default: "" },

    /* ===== IMAGES ===== */
    images: {
      frontView: [String],
      bedRoom: [String],
      kitchen: [String],
      washroom: [String],
    },

    /* ===== DOCUMENTS ===== */
    documents: {
      propertyDocument: [String],
      ownerIdProof: [String],
      addressProof: [String],
      govtLicense: [String],
    },

    /* ===== VENDOR ===== */
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VacationHouse", vacationHouseSchema);