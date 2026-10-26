
const mongoose = require("mongoose");
const VendorReview = require("../models/VendorReview.model");

const ALLOWED_VERTICALS = [
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
];

const getVendorId = (req) =>
  req.vendor?._id || req.user?.vendorId || req.user?._id;

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(String(id || ""));

// GET /api/vendor/reviews
// Get reviews and summary for the authenticated vendor.
exports.getVendorReviews = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId || !isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required.",
      });
    }

    const vertical = String(req.query.vertical || "all").toLowerCase();
    const rating = req.query.rating
      ? Number(req.query.rating)
      : null;
    const status = String(req.query.status || "all").toUpperCase();
    const search = String(req.query.search || "").trim();

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    if (
      vertical !== "all" &&
      !ALLOWED_VERTICALS.includes(vertical)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid vertical filter.",
      });
    }

    if (
      rating !== null &&
      (!Number.isInteger(rating) || rating < 1 || rating > 5)
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5.",
      });
    }

    const allowedStatuses = [
      "ALL",
      "PENDING",
      "APPROVED",
      "REJECTED",
      "HIDDEN",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status.",
      });
    }

    const filter = {
      vendorId: new mongoose.Types.ObjectId(String(vendorId)),
    };

    if (vertical !== "all") filter.vertical = vertical;
    if (rating !== null) filter.rating = rating;
    if (status !== "ALL") filter.status = status;

    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { customerName: { $regex: escapedSearch, $options: "i" } },
        { listingName: { $regex: escapedSearch, $options: "i" } },
        { title: { $regex: escapedSearch, $options: "i" } },
        { comment: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const [reviews, total, aggregate] = await Promise.all([
      VendorReview.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customerId", "name email")
        .lean(),

      VendorReview.countDocuments(filter),

      VendorReview.aggregate([
        {
          $match: {
            vendorId: new mongoose.Types.ObjectId(String(vendorId)),
            ...(vertical !== "all" ? { vertical } : {}),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            averageRating: { $avg: "$rating" },
            replied: {
              $sum: {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ["$vendorReply.message", ""] } }, 0] },
                  1,
                  0,
                ],
              },
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0],
              },
            },
            oneStar: {
              $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] },
            },
            twoStar: {
              $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] },
            },
            threeStar: {
              $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] },
            },
            fourStar: {
              $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] },
            },
            fiveStar: {
              $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const summary = aggregate[0] || {
      total: 0,
      averageRating: 0,
      replied: 0,
      pending: 0,
      oneStar: 0,
      twoStar: 0,
      threeStar: 0,
      fourStar: 0,
      fiveStar: 0,
    };

    return res.status(200).json({
      success: true,
      summary: {
        total: summary.total,
        averageRating: Number(
          (summary.averageRating || 0).toFixed(1)
        ),
        replied: summary.replied,
        unanswered: summary.total - summary.replied,
        pending: summary.pending,
        countsByRating: {
          1: summary.oneStar,
          2: summary.twoStar,
          3: summary.threeStar,
          4: summary.fourStar,
          5: summary.fiveStar,
        },
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      reviews: reviews.map((review) => ({
        ...review,
        customerName:
          review.customerName ||
          review.customerId?.name ||
          "Customer",
        customerEmail: review.customerId?.email || "",
      })),
    });
  } catch (error) {
    console.error("Get vendor reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch reviews.",
    });
  }
};

// PATCH /api/vendor/reviews/:id/reply
// A vendor can reply only to their own review.
exports.replyToReview = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;
    const message = String(req.body?.message || "").trim();

    if (!vendorId || !isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required.",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID.",
      });
    }

    if (!message || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Reply must contain 1–2000 characters.",
      });
    }

    const review = await VendorReview.findOne({
      _id: id,
      vendorId,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found for this vendor.",
      });
    }

    review.vendorReply = {
      message,
      repliedAt: new Date(),
    };

    review.replyUpdatedAt = new Date();

    await review.save();

    return res.status(200).json({
      success: true,
      message: "Reply saved successfully.",
      review: {
        _id: review._id,
        vendorReply: review.vendorReply,
        replyUpdatedAt: review.replyUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Reply to review error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save review reply.",
    });
  }
};
