const express = require("express");

const controller = require("../controllers/cruiseBooking.controller");

/* ==========================================================
   AUTH MIDDLEWARES

   Vendor  -> ../middleware/auth.middleware.js
   Customer-> userAuth middleware (jo file aapne dikhayi thi)

   Customer middleware ka file naam alag ho sakta hai, isliye
   neeche common naam try kiye jaate hain. Agar aapki file ka naam
   in mein nahi hai to USER_AUTH_CANDIDATES mein apna naam add kar dein.
========================================================== */

const vendorProtect = require("../middleware/auth.middleware");

const USER_AUTH_CANDIDATES = [
  "../middleware/userAuth.middleware",
  "../middleware/userAuth",
  "../middleware/user.middleware",
  "../middleware/userauth.middleware",
  "../middleware/user.auth.middleware",
];

const loadUserAuth = () => {
  for (const name of USER_AUTH_CANDIDATES) {
    try {
      return require(name);
    } catch (err) {
      if (err.code !== "MODULE_NOT_FOUND" || !String(err.message).includes(name)) {
        throw err; // file mili par uske andar koi aur error hai
      }
    }
  }
  throw new Error(
    "User auth middleware file not found. Tried: " + USER_AUTH_CANDIDATES.join(", ")
  );
};

const userProtect = loadUserAuth();

/* ==========================================================
   CUSTOMER ROUTES   ->  /api/customer/cruise-bookings
========================================================== */

const customerCruiseBookingRoutes = express.Router();

customerCruiseBookingRoutes.use(userProtect);

customerCruiseBookingRoutes.post("/", controller.createCruiseBooking);
customerCruiseBookingRoutes.get("/", controller.getMyCruiseBookings);
customerCruiseBookingRoutes.get("/:id", controller.getCruiseBookingById);
customerCruiseBookingRoutes.patch("/:id/cancel", controller.cancelCruiseBooking);

/* ==========================================================
   VENDOR ROUTES     ->  /api/vendor/cruise-bookings
========================================================== */

const vendorCruiseBookingRoutes = express.Router();

vendorCruiseBookingRoutes.use(vendorProtect);

vendorCruiseBookingRoutes.get("/", controller.getVendorCruiseBookings);
vendorCruiseBookingRoutes.get("/:id", controller.getVendorCruiseBookingById);
vendorCruiseBookingRoutes.patch("/:id/confirm", controller.confirmCruiseBooking);
vendorCruiseBookingRoutes.patch("/:id/complete", controller.completeCruiseBooking);
vendorCruiseBookingRoutes.patch("/:id/cancel", controller.cancelVendorCruiseBooking);

module.exports = {
  customerCruiseBookingRoutes,
  vendorCruiseBookingRoutes,
};