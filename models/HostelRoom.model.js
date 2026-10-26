const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, index: true },
    roomName: { type: String, required: true, trim: true },
    totalBeds: { type: Number, default: 1, min: 1 },
    pricePerBed: { type: Number, default: 0, min: 0 },
    images: {
      type: [{
        url: String, publicId: String, originalName: String,
        resourceType: { type: String, enum: ["image", "video", "raw"], default: "image" },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HostelRoom", roomSchema);