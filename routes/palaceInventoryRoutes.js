// const express = require("express");

// const router = express.Router();

// const {
//   upsertInventory,
//   getInventory,
//   getInventoryById,
//   deleteInventory,
// } = require("../controllers/palaceInventoryController");


// /* CREATE / UPDATE INVENTORY */
// router.post("/", upsertInventory);


// /* GET INVENTORY */
// router.get("/", getInventory);


// /* GET SINGLE */
// router.get("/:id", getInventoryById);


// /* DELETE */
// router.delete("/:id", deleteInventory);


// module.exports = router;



const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  upsertInventory,
  getInventory,
  getInventoryById,
  deleteInventory,
} = require("../controllers/palaceInventoryController");

router.use(protect);

router.post("/", upsertInventory);
router.get("/", getInventory);
router.get("/:id", getInventoryById);
router.delete("/:id", deleteInventory);

module.exports = router;
