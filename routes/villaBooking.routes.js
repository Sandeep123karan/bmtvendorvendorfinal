
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  createVillaBooking,
  getVendorVillaBookings,
  getVillaBookingById,
  cancelVillaBooking,
} = require("../controllers/villaBooking.controller");

router.use(protect);

// Vendor booking management
router.get("/bookings", getVendorVillaBookings);
router.get("/bookings/:bookingId", getVillaBookingById);
router.patch("/bookings/:bookingId/cancel", cancelVillaBooking);

// Create booking for a specific villa room
router.post(
  "/:villaId/rooms/:roomId/bookings",
  createVillaBooking
);

module.exports = router;
