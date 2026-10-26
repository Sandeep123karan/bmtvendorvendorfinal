


const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const palaceRoomCategorySchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    palace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Palace",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Room category name is required"],
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    roomType: {
      type: String,
      enum: [
        "DELUXE",
        "PREMIUM",
        "ROYAL",
        "HERITAGE",
        "SUITE",
        "MAHARAJA_SUITE",
        "VILLA",
        "OTHER",
      ],
      default: "DELUXE",
    },

    roomSize: {
      type: Number,
      default: 0,
      min: 0,
    },

    roomSizeUnit: {
      type: String,
      enum: ["SQFT", "SQM"],
      default: "SQFT",
    },

    bedType: {
      type: String,
      default: "",
      trim: true,
    },

    bedCount: {
      type: Number,
      default: 1,
      min: 1,
    },

    includedAdults: {
      type: Number,
      default: 2,
      min: 1,
    },

    maxAdults: {
      type: Number,
      default: 2,
      min: 1,
    },

    maxChildren: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxGuests: {
      type: Number,
      default: 2,
      min: 1,
    },

    maxExtraMattress: {
      type: Number,
      default: 0,
      min: 0,
    },

    extraMattressAllowed: {
      type: Boolean,
      default: false,
    },

    totalUnits: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    amenities: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },

    images: {
      type: [imageSchema],
      default: [],
    },

    coverImage: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

palaceRoomCategorySchema.index({
  vendor: 1,
  palace: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "PalaceRoomCategory",
  palaceRoomCategorySchema
);
