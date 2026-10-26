
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  getVendorReviews,
  replyToReview,
} = require("../controllers/vendorReview.controller");

// All review routes require vendor authentication.
router.use(protect);

// GET /api/vendor/reviews
// Supports vertical, rating, status, search, page and limit filters.
router.get("/", getVendorReviews);

// PATCH /api/vendor/reviews/:id/reply
// Save or update a reply to the vendor's own review.
router.patch("/:id/reply", replyToReview);

module.exports = router;
