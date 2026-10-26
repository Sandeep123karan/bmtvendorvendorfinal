


const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");

const {
  createRoomCategory,
  getRoomCategoriesByPalace,
  getRoomCategoryById,
  updateRoomCategory,
  deleteRoomCategory,
  toggleRoomCategory,
} = require("../controllers/palaceRoomCategoryController");

router.use(protect);

// Create room category
router.post("/", upload.any(), createRoomCategory);

// Get all room categories for a palace
router.get("/palace/:palaceId", getRoomCategoriesByPalace);

// Get one room category
router.get("/:id", getRoomCategoryById);

// Update room category
router.put("/:id", upload.any(), updateRoomCategory);

// Activate / deactivate
router.patch("/:id/toggle", toggleRoomCategory);

// Delete room category
router.delete("/:id", deleteRoomCategory);

module.exports = router;
