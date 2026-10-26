
const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");

const authModule = require("../middleware/auth.middleware");
const protect =
  typeof authModule === "function"
    ? authModule
    : authModule.protect;

const {
  createVilla,
  getMyVillas,
  getSingleVilla,
  updateVilla,
  deleteVilla,
  toggleVillaStatus,
  submitVillaForApproval,
} = require("../controllers/villa.controller");

// =====================================================
// AUTH MIDDLEWARE CHECK
// =====================================================

if (typeof protect !== "function") {
  throw new Error(
    "Vendor auth middleware export not found. Check middleware/auth.middleware.js"
  );
}

// =====================================================
// IMAGE UPLOAD FIELDS
// images: multiple villa images
// coverImage: one main cover image
// =====================================================

const villaUpload = upload.fields([
  {
    name: "images",
    maxCount: 30,
  },
  {
    name: "coverImage",
    maxCount: 1,
  },
]);

// =====================================================
// CREATE VILLA
// POST /api/vendor/villas
// =====================================================

router.post(
  "/",
  protect,
  villaUpload,
  createVilla
);

// =====================================================
// GET ALL VILLAS OF LOGGED-IN VENDOR
// GET /api/vendor/villas/my-villas
// =====================================================

router.get(
  "/my-villas",
  protect,
  getMyVillas
);

// =====================================================
// SUBMIT VILLA FOR APPROVAL
// PATCH /api/vendor/villas/:id/submit
// =====================================================

router.patch(
  "/:id/submit",
  protect,
  submitVillaForApproval
);

// =====================================================
// TOGGLE ACTIVE / INACTIVE
// PATCH /api/vendor/villas/:id/toggle-status
// =====================================================

router.patch(
  "/:id/toggle-status",
  protect,
  toggleVillaStatus
);

// =====================================================
// GET SINGLE VILLA
// GET /api/vendor/villas/:id
// =====================================================

router.get(
  "/:id",
  protect,
  getSingleVilla
);

// =====================================================
// UPDATE VILLA
// PUT /api/vendor/villas/:id
// =====================================================

router.put(
  "/:id",
  protect,
  villaUpload,
  updateVilla
);

// =====================================================
// DELETE VILLA
// DELETE /api/vendor/villas/:id
// =====================================================

router.delete(
  "/:id",
  protect,
  deleteVilla
);

module.exports = router;
