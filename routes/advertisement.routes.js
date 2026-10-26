
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  createAdvertisement,
  getMyAdvertisements,
  getAdvertisementById,
  updateAdvertisement,
  toggleAdvertisementStatus,
  deleteAdvertisement,
} = require("../controllers/advertisement.controller");

// All advertisement routes require authentication
router.use(protect);

// Create advertisement
router.post("/", createAdvertisement);

// Get all advertisements for logged-in vendor
router.get("/", getMyAdvertisements);

// Get one advertisement
router.get("/:id", getAdvertisementById);

// Update advertisement
router.put("/:id", updateAdvertisement);

// Pause / resume advertisement
router.patch("/:id/status", toggleAdvertisementStatus);

// Delete advertisement
router.delete("/:id", deleteAdvertisement);

module.exports = router;
