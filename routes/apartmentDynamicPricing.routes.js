const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  createDynamicPricing,
  getDynamicPricing,
  getPriceCalendar,
  updateDynamicPricing,
  deleteDynamicPricing,
  toggleDynamicPricing,
} = require("../controllers/ApartmentDynamicPricing.controller");

router.use(protect);

// FINAL PRICE PER DAY (calendar)
router.get(
  "/apartment/:apartmentId/rate-plan/:ratePlanId/calendar",
  getPriceCalendar
);

// CREATE
router.post(
  "/apartment/:apartmentId/rate-plan/:ratePlanId",
  createDynamicPricing
);

// LIST RULES
router.get(
  "/apartment/:apartmentId/rate-plan/:ratePlanId",
  getDynamicPricing
);

// UPDATE
router.put("/:pricingId", updateDynamicPricing);

// DELETE
router.delete("/:pricingId", deleteDynamicPricing);

// ACTIVE / INACTIVE
router.patch("/:pricingId/toggle", toggleDynamicPricing);

module.exports = router;