const express = require("express");
const protect = require("../middleware/auth.middleware");
const {
  getInventory,
  bulkUpsert,
  updateDay,
  clearRange,
} = require("../controllers/ApartmentInventory.controller");

const router = express.Router();

router.use(protect);

router.get("/:apartmentId", getInventory);
router.post("/:apartmentId/bulk", bulkUpsert);
router.patch("/:apartmentId/:date", updateDay);
router.delete("/:apartmentId", clearRange);

module.exports = router;