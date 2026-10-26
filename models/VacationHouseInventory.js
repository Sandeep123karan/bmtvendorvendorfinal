const mongoose = require("mongoose");

const vacationHouseInventorySchema = new mongoose.Schema(
  {
    houseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VacationHouse",
      required: true,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    // Date ko YYYY-MM-DD string mein store karenge
    date: {
      type: String,
      required: true,
    },

    totalUnits: {
      type: Number,
      default: 1,
      min: 1,
      required: true,
    },

    bookedUnits: {
      type: Number,
      default: 0,
      min: 0,
    },

    blockedUnits: {
      type: Number,
      default: 0,
      min: 0,
    },

    priceOverride: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  { timestamps: true }
);

// Ek house ke ek date par sirf ek inventory record
vacationHouseInventorySchema.index(
  { houseId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "VacationHouseInventory",
  vacationHouseInventorySchema
);