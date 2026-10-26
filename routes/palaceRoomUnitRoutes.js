// const express = require("express");
// const router = express.Router();

// const protect = require("../middleware/auth.middleware");

// const {
//   createRoomUnit,
//   getRoomUnitsByPalace,
//   getRoomUnitsByCategory,
//   getRoomUnitById,
//   updateRoomUnit,
//   updateRoomStatus,
//   updateHousekeepingStatus,
//   deleteRoomUnit,
// } = require(
//   "../controllers/palaceRoomUnitController"
// );


// router.use(protect);


// // CREATE ROOM UNIT
// router.post(
//   "/",
//   createRoomUnit
// );


// // GET ALL ROOMS OF PALACE
// router.get(
//   "/palace/:palaceId",
//   getRoomUnitsByPalace
// );


// // GET ALL ROOMS OF CATEGORY
// router.get(
//   "/category/:roomCategoryId",
//   getRoomUnitsByCategory
// );


// // GET SINGLE ROOM
// router.get(
//   "/:id",
//   getRoomUnitById
// );


// // UPDATE ROOM
// router.put(
//   "/:id",
//   updateRoomUnit
// );


// // UPDATE ROOM STATUS
// router.patch(
//   "/:id/status",
//   updateRoomStatus
// );


// // UPDATE HOUSEKEEPING STATUS
// router.patch(
//   "/:id/housekeeping",
//   updateHousekeepingStatus
// );


// // DELETE
// router.delete(
//   "/:id",
//   deleteRoomUnit
// );


// module.exports = router;



const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  createRoomUnit,
  getRoomUnitsByPalace,
  getRoomUnitsByCategory,
  getRoomUnitById,
  updateRoomUnit,
  updateRoomStatus,
  updateHousekeepingStatus,
  deleteRoomUnit,
} = require("../controllers/palaceRoomUnitController");

router.use(protect);

router.post("/", createRoomUnit);
router.get("/palace/:palaceId", getRoomUnitsByPalace);
router.get("/category/:roomCategoryId", getRoomUnitsByCategory);
router.get("/:id", getRoomUnitById);
router.put("/:id", updateRoomUnit);
router.patch("/:id/status", updateRoomStatus);
router.patch("/:id/housekeeping", updateHousekeepingStatus);
router.delete("/:id", deleteRoomUnit);

module.exports = router;
