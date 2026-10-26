const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth.middleware"); // vendor
const userAuth = require("../middleware/userAuth.middleware"); // user (file ka naam apne project ke hisaab se check karo)

const {
  createBooking,
  getMyBookings,
  getMyBookingById,
  updateMyBooking,
  cancelMyBooking,
  deleteMyBooking,
  getVendorBookings,
  getVendorDashboard,
  getBookingById,
  confirmBooking,
  assignDriver,
  startTrip,
  completeTrip,
  cancelBooking,
  deleteBooking,
} = require("../controllers/cabBooking.controller");

/* ================= VENDOR (pehle, taaki /:id se na takraye) ================= */

router.get("/vendor/dashboard", protect, getVendorDashboard); // /vendor/:id se pehle
router.get("/vendor/my-bookings", protect, getVendorBookings);
router.get("/vendor/:id", protect, getBookingById);
router.patch("/vendor/:id/confirm", protect, confirmBooking);
router.patch("/vendor/:id/assign-driver", protect, assignDriver);
router.patch("/vendor/:id/start-trip", protect, startTrip);
router.patch("/vendor/:id/complete-trip", protect, completeTrip);
router.patch("/vendor/:id/cancel", protect, cancelBooking);
router.delete("/vendor/:id", protect, deleteBooking);

/* ================= USER ================= */

router.post("/", userAuth, createBooking); // Create
router.get("/my-bookings", userAuth, getMyBookings); // Read (list)
router.get("/:id", userAuth, getMyBookingById); // Read (single)
router.put("/:id", userAuth, updateMyBooking); // Update
router.patch("/:id/cancel", userAuth, cancelMyBooking); // Cancel
router.delete("/:id", userAuth, deleteMyBooking); // Delete

module.exports = router;