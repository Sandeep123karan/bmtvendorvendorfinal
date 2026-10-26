
const mongoose = require("mongoose");

const ResortBooking = require("../models/ResortBooking.model");
const ResortReview = require("../models/ResortReview.model");
const Resort = require("../models/Resort.model");

const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED", "HIDDEN"];

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(String(id || ""));

const isValidRating = (value) =>
  Number.isInteger(Number(value)) &&
  Number(value) >= 1 &&
  Number(value) <= 5;

const validateOptionalRatings = (ratings = {}) => {
  const keys = [
    "cleanliness",
    "service",
    "location",
    "valueForMoney",
    "roomQuality",
    "food",
  ];

  const result = {};

  for (const key of keys) {
    const value = ratings[key];

    if (value === undefined || value === null || value === "") {
      result[key] = null;
      continue;
    }

    if (!isValidRating(value)) {
      throw new Error(`${key} rating must be an integer from 1 to 5.`);
    }

    result[key] = Number(value);
  }

  return result;
};

const cleanStringArray = (value, fieldName) => {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
};

const sendError = (res, error, label) => {
  console.error(`${label}:`, error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A review already exists for this booking.",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Something went wrong while processing the review.",
  });
};

/* ==========================================================
   CUSTOMER: CREATE REVIEW
   POST /
========================================================== */

exports.createReview = async (req, res) => {
  try {
    const {
      bookingId,
      rating,
      ratings = {},
      title = "",
      comment,
      pros = [],
      cons = [],
      images = [],
    } = req.body || {};

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Please log in as a customer.",
      });
    }

    if (!bookingId || !isValidId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "A valid bookingId is required.",
      });
    }

    if (!isValidRating(rating)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer from 1 to 5.",
      });
    }

    if (typeof comment !== "string" || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: "Review comment is required.",
      });
    }

    if (comment.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 2000 characters.",
      });
    }

    if (typeof title !== "string" || title.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: "Title must be a string of up to 150 characters.",
      });
    }

    if (!Array.isArray(images) || images.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Images must be an array with at most 10 items.",
      });
    }

    for (const image of images) {
      if (!image || typeof image.url !== "string" || !image.url.trim()) {
        return res.status(400).json({
          success: false,
          message: "Each image must include a valid URL.",
        });
      }
    }

    const cleanRatings = validateOptionalRatings(ratings);
    const cleanPros = cleanStringArray(pros, "pros");
    const cleanCons = cleanStringArray(cons, "cons");

    const booking = await ResortBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    // Only the customer who owns this booking can review it.
    if (
      !booking.customer ||
      String(booking.customer) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only review your own booking.",
      });
    }

    if (booking.bookingStatus !== "CHECKED_OUT") {
      return res.status(400).json({
        success: false,
        message: "A review can only be submitted after check-out.",
      });
    }

    const existingReview = await ResortReview.findOne({
      booking: booking._id,
    }).lean();

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "A review has already been submitted for this booking.",
      });
    }

    if (!booking.leadGuest?.name || !booking.leadGuest?.phone) {
      return res.status(400).json({
        success: false,
        message: "Booking guest details are incomplete.",
      });
    }

    const review = await ResortReview.create({
      resort: booking.resort,
      vendor: booking.vendor,
      booking: booking._id,

      guest: {
        name: booking.leadGuest.name,
        email: booking.leadGuest.email || "",
        phone: booking.leadGuest.phone || "",
      },

      rating: Number(rating),
      ratings: cleanRatings,

      title: title.trim(),
      comment: comment.trim(),
      pros: cleanPros,
      cons: cleanCons,
      images: images.map((image) => ({
        url: image.url.trim(),
        publicId: String(image.publicId || "").trim(),
      })),

      status: "PENDING",
      isVerifiedStay: true,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully and is awaiting approval.",
      review,
    });
  } catch (error) {
    if (error.message?.includes("rating must be")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message?.includes("must be an array") ||
      error.message?.includes("must be an integer")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return sendError(res, error, "Create Resort Review Error");
  }
};

/* ==========================================================
   VENDOR: GET REVIEW LIST
   GET /?resortId=...&status=APPROVED&page=1&limit=20
========================================================== */

exports.getVendorReviews = async (req, res) => {
  try {
    if (!req.vendor?._id) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const {
      resortId,
      status,
      page = "1",
      limit = "20",
    } = req.query;

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = {
      vendor: req.vendor._id,
    };

    if (resortId) {
      if (!isValidId(resortId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid resortId.",
        });
      }

      filter.resort = resortId;
    }

    if (status) {
      const safeStatus = String(status).toUpperCase();

      if (!REVIEW_STATUSES.includes(safeStatus)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${REVIEW_STATUSES.join(", ")}.`,
        });
      }

      filter.status = safeStatus;
    }

    const skip = (safePage - 1) * safeLimit;

    const [reviews, total] = await Promise.all([
      ResortReview.find(filter)
        .populate("resort", "name")
        .populate("booking", "bookingId checkIn checkOut bookingStatus")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),

      ResortReview.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      reviews,
    });
  } catch (error) {
    return sendError(res, error, "Get Vendor Reviews Error");
  }
};

/* ==========================================================
   VENDOR: GET SINGLE REVIEW
   GET /:id
========================================================== */

exports.getReviewById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID.",
      });
    }

    const review = await ResortReview.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    })
      .populate("resort", "name address")
      .populate(
        "booking",
        "bookingId checkIn checkOut bookingStatus roomCategory"
      );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    return res.status(200).json({
      success: true,
      review,
    });
  } catch (error) {
    return sendError(res, error, "Get Resort Review Error");
  }
};

/* ==========================================================
   VENDOR: REPLY TO REVIEW
   PUT /:id/reply
========================================================== */

exports.replyToReview = async (req, res) => {
  try {
    const { message } = req.body || {};

    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID.",
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required.",
      });
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Reply cannot exceed 2000 characters.",
      });
    }

    const review = await ResortReview.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or access denied.",
      });
    }

    if (!review.isActive || review.status === "HIDDEN") {
      return res.status(400).json({
        success: false,
        message: "Cannot reply to an inactive or hidden review.",
      });
    }

    review.vendorReply = {
      message: message.trim(),
      repliedAt: new Date(),
    };

    await review.save();

    return res.status(200).json({
      success: true,
      message: "Vendor reply saved successfully.",
      review,
    });
  } catch (error) {
    return sendError(res, error, "Reply To Resort Review Error");
  }
};

/* ==========================================================
   VENDOR: REVIEW SUMMARY
   GET /summary/:resortId
========================================================== */

exports.getReviewSummary = async (req, res) => {
  try {
    const { resortId } = req.params;

    if (!isValidId(resortId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid resortId.",
      });
    }

    // Verify the resort belongs to the logged-in vendor.
    const resort = await Resort.findOne({
      _id: resortId,
      vendor: req.vendor._id,
    })
      .select("_id name")
      .lean();

    if (!resort) {
      return res.status(404).json({
        success: false,
        message: "Resort not found or access denied.",
      });
    }

    const summaryResult = await ResortReview.aggregate([
      {
        $match: {
          vendor: new mongoose.Types.ObjectId(String(req.vendor._id)),
          resort: new mongoose.Types.ObjectId(resortId),
          status: "APPROVED",
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },

          fiveStar: {
            $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] },
          },
          fourStar: {
            $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] },
          },
          threeStar: {
            $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] },
          },
          twoStar: {
            $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] },
          },
          oneStar: {
            $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] },
          },
        },
      },
    ]);

    const data = summaryResult[0] || {
      totalReviews: 0,
      averageRating: 0,
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0,
    };

    const summary = {
      totalReviews: data.totalReviews,
      averageRating: Number((data.averageRating || 0).toFixed(1)),
      fiveStar: data.fiveStar,
      fourStar: data.fourStar,
      threeStar: data.threeStar,
      twoStar: data.twoStar,
      oneStar: data.oneStar,
    };

    return res.status(200).json({
      success: true,
      resort,
      summary,
    });
  } catch (error) {
    return sendError(res, error, "Get Resort Review Summary Error");
  }
};
