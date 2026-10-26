
const mongoose = require("mongoose");

const villaRoomInventorySchema = new mongoose.Schema(
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

    date: {
      type: Date,
      required: true,
      index: true,
    },

    totalRooms: {
      type: Number,
      required: true,
      min: 0,
    },

    bookedRooms: {
      type: Number,
      default: 0,
      min: 0,
    },

    blockedRooms: {
      type: Number,
      default: 0,
      min: 0,
    },

    availableRooms: {
      type: Number,
      required: true,
      min: 0,
    },

    isClosed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Same room ke liye ek date par sirf ek inventory record.
villaRoomInventorySchema.index(
  { villaId: 1, roomId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "VillaRoomInventory",
  villaRoomInventorySchema
);
