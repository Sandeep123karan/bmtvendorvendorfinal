// const express = require("express");
// const router = express.Router();

// const protect = require("../middleware/auth.middleware");

// const {
//   createRatePlan,
//   getRatePlansByRoomCategory,
//   getRatePlanById,
//   updateRatePlan,
//   toggleRatePlan,
//   deleteRatePlan,
// } = require(
//   "../controllers/palaceRatePlanController"
// );


// router.use(protect);


// // CREATE
// router.post("/", createRatePlan);


// // GET RATE PLANS BY ROOM CATEGORY
// router.get(
//   "/room-category/:roomCategoryId",
//   getRatePlansByRoomCategory
// );


// // GET SINGLE
// router.get("/:id", getRatePlanById);


// // UPDATE
// router.put("/:id", updateRatePlan);


// // TOGGLE
// router.patch("/:id/toggle", toggleRatePlan);


// // DELETE
// router.delete("/:id", deleteRatePlan);


// module.exports = router;




const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  createRatePlan,
  getRatePlansByRoomCategory,
  getRatePlanById,
  updateRatePlan,
  toggleRatePlan,
  deleteRatePlan,
} = require("../controllers/palaceRatePlanController");

router.use(protect);

router.post("/", createRatePlan);
router.get(
  "/category/:roomCategoryId",
  getRatePlansByRoomCategory
);
router.get("/:id", getRatePlanById);
router.put("/:id", updateRatePlan);
router.patch("/:id/toggle", toggleRatePlan);
router.delete("/:id", deleteRatePlan);

module.exports = router;
