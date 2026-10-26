const express = require("express");

const protect = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");

const {
  createApartment,
  getMyApartments,
  getApartmentById,
  updateApartment,
  deleteApartment,
  toggleActiveStatus,
} = require("../controllers/Apartment.controller");


const router = express.Router();


// All apartment vendor APIs protected
router.use(protect);


// CREATE
router.post(
  "/",
  upload.array("images", 10),
  createApartment
);


// MY APARTMENTS
router.get(
  "/",
  getMyApartments
);


// SINGLE APARTMENT
router.get(
  "/:id",
  getApartmentById
);


// UPDATE
router.put(
  "/:id",
  upload.array("images", 10),
  updateApartment
);


// DELETE
router.delete(
  "/:id",
  deleteApartment
);


// ACTIVE / INACTIVE
router.patch(
  "/:id/toggle",
  toggleActiveStatus
);


module.exports = router;