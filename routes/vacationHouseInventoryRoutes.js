const express = require("express");
const router = express.Router();

const protectVendor = require("../middleware/auth.middleware");

const {
  getInventory,
  setInventory,
  setBlockedUnits,
  deleteInventory,
} = require("../controllers/vacationHouseInventoryController");

router.use(protectVendor);

// Date range ki inventory
router.get("/:houseId", getInventory);

// Kisi date ki inventory aur price set/update
router.put("/:houseId/date/:date", setInventory);

// Kisi date ke units block/unblock
router.patch("/:houseId/date/:date/block", setBlockedUnits);

// Date ka inventory override delete
router.delete("/:houseId/date/:date", deleteInventory);

module.exports = router;