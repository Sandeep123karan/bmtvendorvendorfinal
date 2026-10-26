const express = require("express");
const multer = require("multer");
const ctrl = require("../controllers/hostel.controller");

// ⚠️ Yeh line apne hotel.routes.js se copy karo (jo vendor auth middleware wahan use ho raha hai)
const { protectVendor } = require("../middleware/auth.middleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 40 },
});

const uploadFields = (req, res, next) =>
  upload.fields([
    { name: "images", maxCount: 30 },
    { name: "documents", maxCount: 10 },
  ])(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });

router.use(protectVendor);

router.post("/", uploadFields, ctrl.createHostel);
router.get("/", ctrl.getMyHostels);
router.get("/:hostelId", ctrl.getHostelById);
router.put("/:hostelId", uploadFields, ctrl.updateHostel);
router.delete("/:hostelId", ctrl.deleteHostel);

module.exports = router;