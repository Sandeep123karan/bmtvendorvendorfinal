const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");

const {
  createPalace,
  getMyPalaces,
  getPalaceById,
  updatePalace,
  deletePalace,
  togglePalaceStatus,
  setCoverImage,
  deletePalaceImage,
} = require("../controllers/palaceController");

router.use(protect);

// Create palace + upload gallery (goes live immediately)
router.post("/", upload.array("images", 30), createPalace);

// List logged-in vendor's palaces
router.get("/", getMyPalaces);

// More-specific routes before /:id routes
router.patch("/:id/cover", setCoverImage);
router.delete("/:id/images", deletePalaceImage);

// Activate / Deactivate (APPROVED <-> INACTIVE)
router.patch("/:id/toggle", togglePalaceStatus);

// Single palace
router.get("/:id", getPalaceById);

// Update details + append new gallery images
router.put("/:id", upload.array("images", 30), updatePalace);

// Delete palace and gallery cleanup
router.delete("/:id", deletePalace);

module.exports = router;