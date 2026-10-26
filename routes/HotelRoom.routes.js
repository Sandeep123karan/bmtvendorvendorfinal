const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const upload = require("../utils/upload"); // same multer util jo hotel routes me use ho raha hai

const {
  createRoom,
  getHotelRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
  updateRoomInventory,
  deleteRoomImage,
} = require("../controllers/HotelRoom.controller");

router.use(protect);

const roomImages = upload.fields([{ name: "images", maxCount: 10 }]);

// POST /api/hotel-rooms
router.post("/", roomImages, createRoom);

// GET /api/hotel-rooms/hotel/:hotelId   (":roomId" se pehle rakhna zaruri hai)
router.get("/hotel/:hotelId", getHotelRooms);

// GET /api/hotel-rooms/:roomId
router.get("/:roomId", getRoomById);

// PUT /api/hotel-rooms/:roomId
router.put("/:roomId", roomImages, updateRoom);

// DELETE /api/hotel-rooms/:roomId
router.delete("/:roomId", deleteRoom);

// PUT /api/hotel-rooms/:roomId/status
router.put("/:roomId/status", updateRoomStatus);

// PUT /api/hotel-rooms/:roomId/inventory
router.put("/:roomId/inventory", updateRoomInventory);

// PUT /api/hotel-rooms/:roomId/images/delete
router.put("/:roomId/images/delete", deleteRoomImage);

module.exports = router;