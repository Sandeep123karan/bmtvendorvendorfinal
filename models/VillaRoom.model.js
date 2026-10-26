
const mongoose = require("mongoose");

const villaRoomSchema = new mongoose.Schema(
  {
    // Parent villa
    villa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Villa",
      required: true,
      index: true,
    },

    // Vendor who owns this room
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    // Basic room details
    roomName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    roomNumber: {
      type: String,
      trim: true,
      default: "",
    },

    roomType: {
      type: String,
      enum: [
        "standard",
        "deluxe",
        "super-deluxe",
        "premium",
        "suite",
        "master-bedroom",
        "family-room",
        "private-room",
        "shared-room",
        "other",
      ],
      default: "standard",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Bed configuration
    bedType: {
      type: String,
      enum: [
        "single",
        "twin",
        "double",
        "queen",
        "king",
        "bunk",
        "multiple",
        "other",
      ],
      default: "double",
    },

    bedCount: {
      type: Number,
      min: 1,
      default: 1,
    },

    // Guest capacity
    maxGuests: {
      type: Number,
      required: true,
      min: 1,
    },

    maxAdults: {
      type: Number,
      min: 1,
      default: 2,
    },

    maxChildren: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Room size and floor
    floorNumber: {
      type: String,
      default: "",
      trim: true,
    },

    roomSize: {
      type: Number,
      min: 0,
      default: 0,
    },

    roomSizeUnit: {
      type: String,
      enum: ["sqft", "sqm"],
      default: "sqft",
    },

    // Inventory
    totalRooms: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    bookedRooms: {
      type: Number,
      min: 0,
      default: 0,
    },

    blockedRooms: {
      type: Number,
      min: 0,
      default: 0,
    },

    availableRooms: {
      type: Number,
      min: 0,
      default: 1,
    },

    // Pricing
    pricePerNight: {
      type: Number,
      required: true,
      min: 0,
    },

    weekendPrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    extraGuestAllowed: {
      type: Boolean,
      default: false,
    },

    extraGuestCharge: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Images uploaded to Cloudinary
    coverImage: {
      type: String,
      trim: true,
      default: "",
    },

    images: {
      type: [String],
      default: [],
    },

    // Optional Cloudinary public IDs for safe image deletion
    coverImagePublicId: {
      type: String,
      default: "",
    },

    imagePublicIds: {
      type: [String],
      default: [],
    },

    // Amenities, e.g. AC, Wi-Fi, TV
    amenities: {
      type: [String],
      default: [],
    },

    // Housekeeping / vendor notes
    descriptionNotes: {
      type: String,
      default: "",
      trim: true,
    },

    // Visibility and availability
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

// Keep room inventory consistent before validation.
villaRoomSchema.pre("validate", function () {
  const total = Number(this.totalRooms || 0);
  const booked = Number(this.bookedRooms || 0);
  const blocked = Number(this.blockedRooms || 0);

  if (booked < 0 || blocked < 0 || total < 1) {
    this.invalidate("totalRooms", "Invalid room inventory values.");
    return;
  }

  if (booked + blocked > total) {
    this.invalidate(
      "totalRooms",
      "Booked rooms plus blocked rooms cannot exceed total rooms."
    );
    return;
  }

  this.availableRooms = total - booked - blocked;
});

// Useful query indexes
villaRoomSchema.index({ villa: 1, vendor: 1 });
villaRoomSchema.index({ vendor: 1, isActive: 1 });
villaRoomSchema.index({ villa: 1, roomName: 1 });

module.exports =
  mongoose.models.VillaRoom ||
  mongoose.model("VillaRoom", villaRoomSchema);
