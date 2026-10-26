
const mongoose = require("mongoose");

// =====================================================
// VILLA MODEL
// Images store Cloudinary URLs, not binary files.
// =====================================================

const villaSchema = new mongoose.Schema(
  {
    // Vendor ownership
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    // Basic details
    name: {
      type: String,
      required: true,
      trim: true,
    },

    propertyType: {
      type: String,
      default: "villa",
      enum: ["villa"],
    },

    shortDescription: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    // Contact details
    contact: {
      name: {
        type: String,
        default: "",
      },
      phone: {
        type: String,
        default: "",
      },
      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },
    },

    // Address and map location
    address: {
      addressLine: {
        type: String,
        default: "",
      },
      city: {
        type: String,
        default: "",
        index: true,
      },
      state: {
        type: String,
        default: "",
      },
      country: {
        type: String,
        default: "India",
      },
      pincode: {
        type: String,
        default: "",
      },
      location: {
        latitude: {
          type: Number,
          default: null,
        },
        longitude: {
          type: Number,
          default: null,
        },
      },
    },

    // Capacity
    bedrooms: {
      type: Number,
      default: 1,
      min: 0,
    },

    bathrooms: {
      type: Number,
      default: 1,
      min: 0,
    },

    maxGuests: {
      type: Number,
      default: 2,
      min: 1,
    },

    // Pricing per night
    pricePerNight: {
      type: Number,
      required: true,
      min: 0,
    },

    // Amenities: Wi-Fi, Pool, Parking, etc.
    amenities: {
      type: [String],
      default: [],
    },

    // Image URLs returned by Cloudinary
    images: {
      type: [String],
      default: [],
    },

    // Main cover image URL
    coverImage: {
      type: String,
      default: "",
    },

    // Check-in / Check-out
    checkInTime: {
      type: String,
      default: "14:00",
    },

    checkOutTime: {
      type: String,
      default: "11:00",
    },

    // Property rules and cancellation policies
    policies: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Admin approval status
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    rejectionReason: {
      type: String,
      default: "",
    },

    // Vendor can enable / disable the listing
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Efficient vendor-wise listing
villaSchema.index({
  vendor: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.Villa ||
  mongoose.model("Villa", villaSchema);
