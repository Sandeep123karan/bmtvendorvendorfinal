const express = require("express");

const router = express.Router();

const protect = require("../middleware/auth.middleware");
const upload = require("../utils/upload");

const {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  deleteRoomImage,
  toggleRoomStatus,
} = require("../controllers/Homestayroom.controller");

/* Saare room routes vendor login maangte hain */
router.use(protect);



router.get("/", getRooms);
router.post("/", upload.array("images", 10), createRoom);
router.put("/:id", upload.array("images", 10), updateRoom);
router.delete("/:id/images", deleteRoomImage);
router.delete("/:id", deleteRoom);
router.patch("/:id/toggle-status", toggleRoomStatus);

module.exports = router;