// routes/HotelInventory.routes.js
// Mount:  ["/api/hotel-inventory", "./routes/HotelInventory.routes"]

const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  createInventory,
  createInventoryRange,
  upsertInventory,
  getInventory,
  getRoomInventory,
  getSingleInventory,
  updateInventory,
  blockInventory,
  unblockInventory,
  stopSellInventory,
  resumeSellInventory,
  deleteInventory,
} = require("../controllers/HotelInventory.controller");

router.use(protect);

/* ---------- LIST / READ ---------- */
// GET /api/hotel-inventory?hotelId=&roomId=&startDate=&endDate=&page=&limit=
router.get("/", getInventory);

// GET /api/hotel-inventory/room/:roomId?from=&to=   (purana calendar view)
router.get("/room/:roomId", getRoomInventory);

/* ---------- CREATE ---------- */
// POST /api/hotel-inventory          (single date, create ya update)
router.post("/", createInventory);

// POST /api/hotel-inventory/range    (startDate -> endDate)
router.post("/range", createInventoryRange);

// PUT /api/hotel-inventory           (purana upsert: date + endDate)
router.put("/", upsertInventory);

/* ---------- SINGLE RECORD ---------- */
router.get("/:inventoryId", getSingleInventory);
router.put("/:inventoryId", updateInventory);
router.delete("/:inventoryId", deleteInventory);

/* ---------- ACTIONS ---------- */
router.patch("/:inventoryId/block", blockInventory);
router.patch("/:inventoryId/unblock", unblockInventory);
router.patch("/:inventoryId/stop-sell", stopSellInventory);
router.patch("/:inventoryId/resume-sell", resumeSellInventory);
router.put("/:inventoryId/stop-sell", stopSellInventory); // purana frontend

module.exports = router;