const mongoose = require("mongoose");

/* ============================================================
   HOMESTAY ROOM MODEL
   Ek Homestay ke andar alag-alag room types
============================================================ */

const homestayRoomSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    homestay: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Homestay",
      required: true,
      index: true,
    },

    roomName: {
      type: String,
      required: true,
      trim: true,
    },

    roomType: {
      type: String,
      enum: ["private-room", "deluxe", "suite", "family", "dormitory", "entire-unit"],
      default: "private-room",
    },

    description: { type: String, default: "", trim: true },

    /* Is type ke kitne rooms available hain */
    totalRooms: { type: Number, default: 1, min: 1 },

    /* Capacity */
    maxGuests: { type: Number, default: 2, min: 1 },
    maxAdults: { type: Number, default: 2, min: 1 },
    maxChildren: { type: Number, default: 0, min: 0 },

    /* Beds & size */
    bedType: {
      type: String,
      enum: ["single", "double", "queen", "king", "twin", "bunk"],
      default: "double",
    },
    totalBeds: { type: Number, default: 1, min: 1 },
    bathrooms: { type: Number, default: 1, min: 0 },
    roomSize: { type: Number, default: 0, min: 0 },
    view: { type: String, default: "", trim: true },

    mealPlan: {
      type: String,
      enum: ["none", "breakfast", "half-board", "full-board", "all-inclusive"],
      default: "none",
    },

    amenities: { type: [String], default: [] },

    pricing: {
      basePrice: { type: Number, required: true, min: 0 },
      weekendPrice: { type: Number, default: 0, min: 0 },
      extraGuestPrice: { type: Number, default: 0, min: 0 },
      extraBedPrice: { type: Number, default: 0, min: 0 },
    },

    images: { type: [String], default: [] },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

homestayRoomSchema.index({ homestay: 1, isActive: 1 });

module.exports = mongoose.model("HomestayRoom", homestayRoomSchema);