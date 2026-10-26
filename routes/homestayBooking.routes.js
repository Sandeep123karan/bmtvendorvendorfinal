// routes/homestayBooking.routes.js
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware"); // VENDOR auth  -> req.vendor
// USER auth -> req.user.  File ka naam/path apne project ke hisaab se badlo
const userAuth = require("../middleware/userAuth.middleware");

const {
  checkAvailability,
  createBooking,
  getMyBookings,
  getMyBookingById,
  cancelBooking,
  getVendorBookings,
  getVendorBookingById,
  confirmBooking,
  rejectBooking,
  checkIn,
  checkOut,
  completeBooking,
} = require("../controllers/homestayBooking.controller");

/* ---------- PUBLIC ---------- */
// GET /api/homestay-bookings/availability?roomId=&checkInDate=&checkOutDate=&unitsBooked=&adults=&children=
router.get("/availability", checkAvailability);

/* ---------- USER ---------- */
router.post("/", userAuth, createBooking);
router.get("/my-bookings", userAuth, getMyBookings);
router.get("/my-bookings/:bookingId", userAuth, getMyBookingById);
router.put("/:bookingId/cancel", userAuth, cancelBooking);

/* ---------- VENDOR ---------- */
router.get("/vendor", protect, getVendorBookings);
router.get("/vendor/:bookingId", protect, getVendorBookingById);
router.put("/vendor/:bookingId/confirm", protect, confirmBooking);
router.put("/vendor/:bookingId/reject", protect, rejectBooking);
router.put("/vendor/:bookingId/check-in", protect, checkIn);
router.put("/vendor/:bookingId/check-out", protect, checkOut);
router.put("/vendor/:bookingId/complete", protect, completeBooking);

module.exports = router;