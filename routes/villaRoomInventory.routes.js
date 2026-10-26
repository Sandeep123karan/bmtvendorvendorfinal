
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  getRoomInventory,
  upsertRoomInventory,
  getRoomInventorySummary,
} = require("../controllers/villaRoomInventory.controller");

router.use(protect);

router.get(
  "/:villaId/rooms/:roomId/inventory/summary",
  getRoomInventorySummary
);

router.get(
  "/:villaId/rooms/:roomId/inventory",
  getRoomInventory
);

router.post(
  "/:villaId/rooms/:roomId/inventory",
  upsertRoomInventory
);

module.exports = router;
