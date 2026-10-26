
const mongoose = require("mongoose");

const vendorReviewSchema = new mongoose.Schema(
  {
    // Vendor who owns the listing being reviewed
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    // Vertical / business category
    vertical: {
      type: String,
      required: true,
      enum: [
        "cab",
        "bus",
        "stay",
        "hotel",
        "homestay",
        "resort",
        "villa",
        "apartment",
        "activity",
        "tour",
        "cruise",
        "nightclub",
        "event",
        "holiday-package",
        "darshan",
        "other",
      ],
      lowercase: true,
      trim: true,
      index: true,
    },

    // Listing being reviewed (cab, bus, property, activity, etc.)
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    listingName: {
      type: String,
      trim: true,
      default: "",
    },

    // Customer who submitted the review
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    customerName: {
      type: String,
      trim: true,
      default: "",
    },

    // Booking used to verify that this review is genuine
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number from 1 to 5.",
      },
    },

    title: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    comment: {
      type: String,
      trim: true,
      required: true,
      minlength: 3,
      maxlength: 3000,
    },

    // Optional rating breakdown
    ratingBreakdown: {
      service: { type: Number, min: 1, max: 5 },
      cleanliness: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
    },

    // Vendor reply
    vendorReply: {
      message: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: "",
      },
      repliedAt: {
        type: Date,
        default: null,
      },
    },

    // Moderation
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "HIDDEN"],
      default: "PENDING",
      index: true,
    },

    isVerifiedBooking: {
      type: Boolean,
      default: false,
      index: true,
    },

    moderatedAt: {
      type: Date,
      default: null,
    },

    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    // Optional vendor response status / audit
    replyUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One review per customer per booking.
vendorReviewSchema.index(
  { customerId: 1, bookingId: 1 },
  { unique: true }
);

// Dashboard listing query support.
vendorReviewSchema.index({
  vendorId: 1,
  vertical: 1,
  status: 1,
  createdAt: -1,
});

vendorReviewSchema.index({
  vendorId: 1,
  rating: 1,
  createdAt: -1,
});

module.exports = mongoose.model("VendorReview", vendorReviewSchema);
