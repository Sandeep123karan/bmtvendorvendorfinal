
const mongoose = require("mongoose");

const ratingValidator = {
  validator: function (value) {
    return value === null || value === undefined ||
      (Number.isFinite(value) && value >= 1 && value <= 5);
  },
  message: "Rating must be between 1 and 5.",
};

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

const resortReviewSchema = new mongoose.Schema(
  {
    resort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resort",
      required: true,
      index: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResortBooking",
      required: true,
      unique: true,
      index: true,
    },

    guest: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        default: "",
        trim: true,
      },
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: ratingValidator,
    },

    ratings: {
      cleanliness: { type: Number, default: null, min: 1, max: 5, validate: ratingValidator },
      service: { type: Number, default: null, min: 1, max: 5, validate: ratingValidator },
      location: { type: Number, default: null, min: 1, max: 5, validate: ratingValidator },
      valueForMoney: { type: Number, default: null, min: 1, max: 5, validate: ratingValidator },
      roomQuality: { type: Number, default: null, min: 1, max: 5, validate: ratingValidator },
      food: { type: Number, default: null, min: 1, max: 5, validate: ratingValidator },
    },

    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    pros: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      default: [],
    },

    cons: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      default: [],
    },

    images: {
      type: [imageSchema],
      default: [],
      validate: {
        validator: (images) => images.length <= 10,
        message: "A maximum of 10 review images is allowed.",
      },
    },

    vendorReply: {
      message: {
        type: String,
        default: "",
        trim: true,
        maxlength: 2000,
      },
      repliedAt: {
        type: Date,
        default: null,
      },
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "HIDDEN"],
      default: "PENDING",
      index: true,
    },

    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },

    isVerifiedStay: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

resortReviewSchema.index({ resort: 1, status: 1, createdAt: -1 });
resortReviewSchema.index({ vendor: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("ResortReview", resortReviewSchema);
