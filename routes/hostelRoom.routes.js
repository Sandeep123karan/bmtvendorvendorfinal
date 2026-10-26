const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");

const {
  createHostelRoom,
  getMyRooms,
  getHostelRooms,
  getHostelRoomById,
  updateHostelRoom,
  deleteHostelRoom,
} = require("../controllers/hostelRoom.controller");

router.use(protect);

// Same multer instance as hostel.routes.js (memoryStorage -> file.buffer)
const roomUpload = upload.fields([{ name: "images", maxCount: 10 }]);

router.post("/", roomUpload, createHostelRoom);
router.get("/", getMyRooms); // all rooms of this vendor (list page)
router.get("/:hostelId", getHostelRooms); // rooms of one hostel
router.get("/:hostelId/room/:roomId", getHostelRoomById);
router.put("/:hostelId/room/:roomId", roomUpload, updateHostelRoom);
router.delete("/:hostelId/room/:roomId", deleteHostelRoom);

module.exports = router;