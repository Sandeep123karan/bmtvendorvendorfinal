
const express = require("express");
const router = express.Router();
const multer = require("multer");

const protect = require("../middleware/auth.middleware");

const {
  createVillaRoom,
  getVillaRooms,
  getVillaRoomById,
  updateVillaRoom,
  deleteVillaRoom,
  toggleVillaRoomStatus,
} = require("../controllers/villaRoom.controller");

// --------------------------------------------------
// MULTER CONFIGURATION
// --------------------------------------------------

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per image
    files: 21, // 1 cover + up to 20 gallery images
    fields: 40,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/avif",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Only JPG, PNG, WEBP and AVIF images are allowed.")
      );
    }

    cb(null, true);
  },
});

const roomImageUpload = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "images", maxCount: 20 },
]);

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

router.use(protect);

// --------------------------------------------------
// VILLA ROOM CRUD
// Mount prefix: /api/vendor/villas
// --------------------------------------------------

// GET all rooms belonging to a villa
router.get("/:villaId/rooms", getVillaRooms);

// CREATE room with cover image and gallery
router.post("/:villaId/rooms", roomImageUpload, createVillaRoom);

// GET one room
router.get("/:villaId/rooms/:roomId", getVillaRoomById);

// UPDATE room and optionally upload new images
router.put("/:villaId/rooms/:roomId", roomImageUpload, updateVillaRoom);

// DELETE room and its stored images
router.delete("/:villaId/rooms/:roomId", deleteVillaRoom);

// ACTIVATE / DEACTIVATE room
router.patch(
  "/:villaId/rooms/:roomId/toggle-status",
  toggleVillaRoomStatus
);

// --------------------------------------------------
// MULTER ERROR HANDLER
// --------------------------------------------------

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each image must be 5 MB or smaller."
        : err.code === "LIMIT_FILE_COUNT"
        ? "Too many images uploaded."
        : err.code === "LIMIT_UNEXPECTED_FILE"
        ? "Unexpected image field or too many images."
        : err.message;

    return res.status(400).json({
      success: false,
      message,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Image upload failed.",
    });
  }

  next();
});

module.exports = router;
