const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    originalName: { type: String, default: "" },
    resourceType: { type: String, enum: ["image", "video"], default: "image" },
  },
  { _id: true }
);

const hostelSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },

    hostelName: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, trim: true, lowercase: true, index: true },
    hostelType: {
      type: String,
      enum: [
        "Co-Living Hostel", "Student Hostel", "Backpacker Hostel", "Working Professionals Hostel",
        "Girls Hostel", "Boys Hostel", "Mixed Dormitory Hostel", "Other",
      ],
      default: "Co-Living Hostel",
    },
    genderPreference: { type: String, enum: ["Unisex", "Male", "Female"], default: "Unisex" },
    description: { type: String, required: true, trim: true, maxlength: 10000 },

    contactName: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    contactEmail: { type: String, trim: true, lowercase: true, default: "" },

    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    checkInTime: { type: String, default: "12:00" },
    checkOutTime: { type: String, default: "11:00" },

    totalRooms: { type: Number, required: true, min: 1 },
    totalBeds: { type: Number, required: true, min: 1 },

    startingPrice: { type: Number, required: true, min: 1 },
    securityDeposit: { type: Number, default: 0, min: 0 },
    cancellationPolicy: {
      type: String,
      enum: ["Flexible", "Moderate", "Strict", "Non-refundable"],
      default: "Flexible",
    },

    amenities: { type: [String], default: [] },

    images: {
      type: [mediaSchema],
      default: [],
      validate: { validator: (v) => v.length <= 30, message: "Maximum 30 hostel media files allowed." },
    },
    documents: {
      type: [mediaSchema],
      default: [],
      validate: { validator: (v) => v.length <= 10, message: "Maximum 10 documents allowed." },
    },

    // Hostels go live immediately. There is no admin approval step.
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, minimize: false }
);

hostelSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model("Hostel", hostelSchema);