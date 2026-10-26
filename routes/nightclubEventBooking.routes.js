// const express = require("express");

// const router = express.Router();

// const userAuth = require(
//   "../middleware/userAuth.middleware"
// );

// const {
//   createNightClubEventBooking,
//   getMyNightClubEventBookings,
//   getNightClubEventBookingById,
//   cancelNightClubEventBooking,
// } = require(
//   "../controllers/nightclubEventBooking.controller"
// );

// // =====================================================
// // CREATE BOOKING
// // =====================================================

// router.post(
//   "/",
//   userAuth,
//   createNightClubEventBooking
// );

// // =====================================================
// // MY BOOKINGS
// // =====================================================

// router.get(
//   "/my-bookings",
//   userAuth,
//   getMyNightClubEventBookings
// );

// // =====================================================
// // SINGLE BOOKING
// // =====================================================

// router.get(
//   "/:id",
//   userAuth,
//   getNightClubEventBookingById
// );

// // =====================================================
// // CANCEL BOOKING
// // =====================================================

// router.patch(
//   "/:id/cancel",
//   userAuth,
//   cancelNightClubEventBooking
// );

// module.exports = router;

// const express = require("express");

// const router = express.Router();

// const userAuth = require(
//   "../middleware/userAuth.middleware"
// );

// const {
//   createNightClubEventBooking,
//   getMyNightClubEventBookings,
//   getNightClubEventBookingById,
//   cancelNightClubEventBooking,
// } = require(
//   "../controllers/nightclubEventBooking.controller"
// );

// router.post(
//   "/",
//   userAuth,
//   createNightClubEventBooking
// );


// router.get(
//   "/my-bookings",
//   userAuth,
//   getMyNightClubEventBookings
// );

// router.get(
//   "/:id",
//   userAuth,
//   getNightClubEventBookingById
// );


// router.patch(
//   "/:id/cancel",
//   userAuth,
//   cancelNightClubEventBooking
// );

// module.exports = router;

const express = require("express");

const router = express.Router();

const userAuth = require("../middleware/userAuth.middleware");
const vendorAuth = require("../middleware/auth.middleware");

const {
  createNightClubEventBooking,
  getMyNightClubEventBookings,
  getNightClubEventBookingById,
  updateNightClubEventBooking,
  cancelNightClubEventBooking,
  deleteNightClubEventBooking,
  getVendorNightClubEventBookings,
  getVendorNightClubEventBookingById,
  confirmVendorNightClubEventBooking,
  checkInVendorNightClubEventBooking,
  completeVendorNightClubEventBooking,
  cancelVendorNightClubEventBooking,
  deleteVendorNightClubEventBooking,
} = require("../controllers/nightclubEventBooking.controller");

/* ==========================================================
   VENDOR  (/vendor ... )
   "/:id" se pehle likhe hain, warna "vendor" ko id samajh liya jata hai.
========================================================== */

router.get("/vendor", vendorAuth, getVendorNightClubEventBookings);
router.get("/vendor/:id", vendorAuth, getVendorNightClubEventBookingById);

router.patch("/vendor/:id/confirm", vendorAuth, confirmVendorNightClubEventBooking);
router.patch("/vendor/:id/check-in", vendorAuth, checkInVendorNightClubEventBooking);
router.patch("/vendor/:id/complete", vendorAuth, completeVendorNightClubEventBooking);
router.patch("/vendor/:id/cancel", vendorAuth, cancelVendorNightClubEventBooking);

router.delete("/vendor/:id", vendorAuth, deleteVendorNightClubEventBooking);

/* ==========================================================
   CUSTOMER
========================================================== */

router.post("/", userAuth, createNightClubEventBooking);

router.get("/my-bookings", userAuth, getMyNightClubEventBookings);
router.get("/:id", userAuth, getNightClubEventBookingById);

router.put("/:id", userAuth, updateNightClubEventBooking);
router.patch("/:id/cancel", userAuth, cancelNightClubEventBooking);
router.delete("/:id", userAuth, deleteNightClubEventBooking);

module.exports = router;