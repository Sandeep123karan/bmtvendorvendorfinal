
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const userAuth = require("../middleware/userAuth.middleware");

const {
  createReview,
  getVendorReviews,
  getReviewById,
  replyToReview,
  getReviewSummary,
} = require("../controllers/resortReview.controller");

/* ==========================================
   CUSTOMER SIDE
========================================== */

// Customer JWT required
router.post("/", userAuth, createReview);

/* ==========================================
   VENDOR PANEL
========================================== */

router.get("/", protect, getVendorReviews);
router.get("/summary/:resortId", protect, getReviewSummary);
router.get("/:id", protect, getReviewById);
router.put("/:id/reply", protect, replyToReview);

module.exports = router;
