

const router  = require("express").Router();
const protect = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload");

const {
  addHotel,
  getHotels,
  getSingleHotel,
  updateHotel,
  deleteHotel,
  addRoom,
  updateRoom,
  deleteRoom,
  deleteRoomImage,
  deleteHotelImage,
} = require("../controllers/hotel.controller");

router.use(protect);

/* ─── Hotel Routes ─── */
router.post(
  "/",
  upload.fields([
    { name: "hotelImages", maxCount: 10 },
    { name: "roomImages",  maxCount: 10 },
    { name: "videos",      maxCount: 5  },
  ]),
  addHotel
);

router.get("/",          getHotels);
router.get("/:id",       getSingleHotel);

router.put(
  "/:id",
  upload.fields([
    { name: "hotelImages", maxCount: 10 },
    { name: "roomImages",  maxCount: 10 },
    { name: "videos",      maxCount: 5  },
  ]),
  updateHotel
);

router.delete("/:id",                    deleteHotel);
router.delete("/:id/images",             deleteHotelImage);

/* ─── Room Routes ─── */
router.post(
  "/:hotelId/rooms",
  upload.fields([{ name: "roomGallery", maxCount: 10 }]),
  addRoom
);

router.put(
  "/:hotelId/rooms/:roomId",
  upload.fields([{ name: "roomGallery", maxCount: 10 }]),
  updateRoom
);

router.delete("/:hotelId/rooms/:roomId",             deleteRoom);
router.delete("/:hotelId/rooms/:roomId/images",      deleteRoomImage);

module.exports = router;