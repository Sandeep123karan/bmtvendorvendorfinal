
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  createOffer,
  getMyOffers,
  updateOffer,
  toggleOfferStatus,
  deleteOffer,
} = require("../controllers/vendorOffer.controller");

// All offer routes require authentication.
router.use(protect);

// GET all offers belonging to logged-in vendor
router.get("/", getMyOffers);

// CREATE a new offer
router.post("/", createOffer);

// UPDATE an offer
router.put("/:id", updateOffer);

// PAUSE / RESUME an offer
router.patch("/:id/toggle-status", toggleOfferStatus);

// SOFT DELETE an offer
router.delete("/:id", deleteOffer);

module.exports = router;
