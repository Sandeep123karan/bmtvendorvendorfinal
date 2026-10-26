
const mongoose = require("mongoose");

const vendorOfferSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, "Offer title is required"],
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    code: {
      type: String,
      required: [true, "Coupon code is required"],
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 30,
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0.01,
    },

    minimumBookingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    maximumDiscount: {
      type: Number,
      default: null,
      min: 0,
    },

    vertical: {
      type: String,
      required: true,
      enum: [
        "all",
        "stay",
        "hotel",
        "homestay",
        "resort",
        "villa",
        "apartment",
        "cab",
        "bus",
        "tour",
        "activities",
        "holiday",
        "darshan",
        "cruise",
        "nightclub",
        "palace",
        "campsite",
        "bnb",
        "vacation-house",
        "motel",
        "flight",
      ],
      default: "all",
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "paused",
        "rejected",
        "expired",
      ],
      default: "pending",
      index: true,
    },

    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Same vendor cannot create duplicate coupon codes.
vendorOfferSchema.index(
  { vendorId: 1, code: 1 },
  { unique: true }
);

// Validate date range and discount values.
vendorOfferSchema.pre("validate", function () {
  if (
    this.startDate &&
    this.endDate &&
    this.endDate <= this.startDate
  ) {
    this.invalidate(
      "endDate",
      "End date must be after start date"
    );
  }

  if (
    this.discountType === "percentage" &&
    this.discountValue > 100
  ) {
    this.invalidate(
      "discountValue",
      "Percentage discount cannot exceed 100"
    );
  }

  if (
    this.discountType === "fixed" &&
    this.maximumDiscount != null
  ) {
    this.invalidate(
      "maximumDiscount",
      "Maximum discount is only used for percentage offers"
    );
  }
});

module.exports =
  mongoose.models.VendorOffer ||
  mongoose.model("VendorOffer", vendorOfferSchema);
