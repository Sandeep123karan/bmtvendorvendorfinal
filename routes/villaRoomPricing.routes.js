
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  getPricing,
  createPricing,
  updatePricing,
  deletePricing,
} = require("../controllers/villaRoomPricing.controller");

router.use(protect);

router.get(
  "/:villaId/rooms/:roomId/pricing",
  getPricing
);

router.post(
  "/:villaId/rooms/:roomId/pricing",
  createPricing
);

router.patch(
  "/:villaId/rooms/:roomId/pricing/:pricingId",
  updatePricing
);

router.delete(
  "/:villaId/rooms/:roomId/pricing/:pricingId",
  deletePricing
);

module.exports = router;
