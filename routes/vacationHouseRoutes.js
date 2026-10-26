const express = require("express");
const router = express.Router();

const vacationHouseController = require("../controllers/vacationHouseController");
const upload = require("../middleware/upload");
const protectVendor = require("../middleware/auth.middleware");

/* ================= ADD ================= */
router.post(
  "/add",
  protectVendor,
  upload.any(),
  vacationHouseController.addVacationHouse
);

/* ================= LIST (vendor ke apne houses) ================= */
router.get(
  "/my-houses",
  protectVendor,
  vacationHouseController.getVendorVacationHouses
);

/* ================= UPDATE ================= */
router.put(
  "/update/:id",
  protectVendor,
  upload.any(),
  vacationHouseController.updateVacationHouse
);

/* ================= DELETE ================= */
router.delete(
  "/delete/:id",
  protectVendor,
  vacationHouseController.deleteVacationHouse
);

/* ================= SINGLE (hamesha last me) ================= */
router.get(
  "/:id",
  protectVendor,
  vacationHouseController.getSingleVacationHouse
);

module.exports = router;