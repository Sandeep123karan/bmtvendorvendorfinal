
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const userAuth = require("../middleware/userAuth.middleware");

const {
  createBooking,
  getVendorBookings,
  getBookingById,
  updateVendorBookingStatus,
} = require("../controllers/ApartmentBooking.controller");

// CUSTOMER: Create booking using customer login token
router.post("/", userAuth, createBooking);

// VENDOR: Get all bookings belonging to logged-in vendor
router.get("/vendor/my-bookings", protect, getVendorBookings);

// VENDOR: Get one booking belonging to logged-in vendor
router.get("/vendor/:id", protect, getBookingById);

// VENDOR: Update booking status
router.patch(
  "/vendor/:id/status",
  protect,
  updateVendorBookingStatus
);

module.exports = router;
