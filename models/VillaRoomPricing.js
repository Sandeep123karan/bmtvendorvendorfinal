
const mongoose = require("mongoose");

const villaRoomPricingSchema = new mongoose.Schema(
  {
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

    pricePerNight: {
      type: Number,
      required: true,
      min: 0,
    },

    maxGuests: {
      type: Number,
      required: true,
      min: 1,
    },

    adults: {
      type: Number,
      default: 2,
      min: 1,
    },

    children: {
      type: Number,
      default: 0,
      min: 0,
    },

    extraGuestPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "VillaRoomPricing",
  villaRoomPricingSchema
);
