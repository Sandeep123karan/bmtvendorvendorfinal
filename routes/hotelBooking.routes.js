const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");      // vendor
const userAuth = require("../middleware/userAuth.middleware"); // customer  (file ka naam apne project se match karo)

const {
  publicListHotels,
  publicGetHotel,
  publicQuote,
  customerCreateBooking,
  customerMyBookings,
  customerGetBooking,
  customerCancelBooking,
  quoteBooking,
  createBooking,
  getVendorBookings,
  getSingleBooking,
  confirmBooking,
  cancelBooking,
  checkIn,
  checkOut,
  markPaid,
} = require("../controllers/hotelBooking.controller");

/* ================= PUBLIC ================= */
router.get("/public/hotels", publicListHotels);
router.get("/public/hotels/:hotelId", publicGetHotel);
router.post("/public/quote", publicQuote);

/* ================= CUSTOMER ================= */
router.post("/customer", userAuth, customerCreateBooking);
router.get("/customer/my", userAuth, customerMyBookings);
router.get("/customer/:bookingId", userAuth, customerGetBooking);
router.put("/customer/:bookingId/cancel", userAuth, customerCancelBooking);

/* ================= VENDOR ================= */
router.post("/quote", protect, quoteBooking);
router.post("/", protect, createBooking);

router.get("/", protect, getVendorBookings);
router.get("/vendor", protect, getVendorBookings);
router.get("/:bookingId", protect, getSingleBooking);

router.put("/:bookingId/confirm", protect, confirmBooking);
router.put("/:bookingId/cancel", protect, cancelBooking);
router.put("/:bookingId/check-in", protect, checkIn);
router.put("/:bookingId/check-out", protect, checkOut);
router.put("/:bookingId/payment", protect, markPaid);

module.exports = router;