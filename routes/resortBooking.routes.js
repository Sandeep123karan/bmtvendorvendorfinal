
// const express = require("express");
// const router = express.Router();

// const protect = require("../middleware/auth.middleware");
// const userAuth = require("../middleware/userAuth.middleware");

// const {
//   getBookingOptions,
//   getQuote,
//   getStats,
//   getBookings,
//   getBookingById,
//   createBooking,
//   updateBooking,
//   assignRoomUnit,
//   customerGetQuote,
//   customerCreateBooking,
//   customerGetBookings,
//   customerGetBookingById,
//   customerUpdateBooking,
//   customerCancelBooking,
// } = require("../controllers/resortBooking.controller");

// /* =========================================
//    CUSTOMER ROUTES
//    Customer JWT required
// ========================================= */

// // Calculate price only; booking is NOT created
// router.post("/customer/quote", userAuth, customerGetQuote);

// // Create a real booking
// router.post("/customer", userAuth, customerCreateBooking);

// // Customer's own bookings
// router.get("/customer", userAuth, customerGetBookings);
// router.get("/customer/:id", userAuth, customerGetBookingById);

// // Update guest details of a pending booking
// router.put("/customer/:id", userAuth, customerUpdateBooking);

// // Cancel a pending booking
// router.delete("/customer/:id", userAuth, customerCancelBooking);

// /* =========================================
//    VENDOR ROUTES
//    Vendor JWT required
// ========================================= */

// // Dropdowns and booking options
// router.get("/options", protect, getBookingOptions);

// // Booking statistics
// router.get("/stats", protect, getStats);

// // Vendor booking list
// router.get("/", protect, getBookings);

// // Vendor booking details
// router.get("/:id", protect, getBookingById);

// // Vendor creates a booking manually
// router.post("/", protect, createBooking);

// // Vendor updates booking
// router.put("/:id", protect, updateBooking);

// // Assign or clear a room unit
// router.patch("/:id/room-unit", protect, assignRoomUnit);

// // Vendor price quote
// router.post("/quote", protect, getQuote);

// module.exports = router;


const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const userAuth = require("../middleware/userAuth.middleware");

const {
  getBookingOptions,
  getQuote,
  getStats,
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  updateBookingStatus,
  assignRoomUnit,
  customerGetQuote,
  customerCreateBooking,
  customerGetBookings,
  customerGetBookingById,
  customerUpdateBooking,
  customerCancelBooking,
} = require("../controllers/resortBooking.controller");

/* =========================================
   CUSTOMER ROUTES
   Customer JWT required
========================================= */

// Calculate price only
router.post("/customer/quote", userAuth, customerGetQuote);

// Create customer booking
router.post("/customer", userAuth, customerCreateBooking);

// Customer's own bookings
router.get("/customer", userAuth, customerGetBookings);
router.get("/customer/:id", userAuth, customerGetBookingById);

// Update pending booking details
router.put("/customer/:id", userAuth, customerUpdateBooking);

// Cancel pending booking
router.delete("/customer/:id", userAuth, customerCancelBooking);

/* =========================================
   VENDOR ROUTES
   Vendor JWT required
========================================= */

// Dropdowns and booking options
router.get("/options", protect, getBookingOptions);

// Booking statistics
router.get("/stats", protect, getStats);

// Booking list
router.get("/", protect, getBookings);

// IMPORTANT: Put specific routes before /:id
// Update booking status
router.put("/:id/status", protect, updateBookingStatus);

// Assign or clear room unit
router.patch("/:id/room-unit", protect, assignRoomUnit);

// Vendor booking details
router.get("/:id", protect, getBookingById);

// Update booking details (guest, notes, payment method)
router.put("/:id", protect, updateBooking);

// Vendor creates a booking manually
router.post("/", protect, createBooking);

// Vendor price quote
router.post("/quote", protect, getQuote);

module.exports = router;
