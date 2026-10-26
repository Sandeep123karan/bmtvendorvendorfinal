
const mongoose = require("mongoose");
const VillaRoomInventory = require("../models/VillaRoomInventory");

const isValidId = (id) => mongoose.isValidObjectId(id);

const parseDate = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return date;
};

const getAvailability = (item) => {
  const availableRooms = Math.max(
    0,
    item.totalRooms - item.bookedRooms - item.blockedRooms
  );

  return {
    ...item,
    availableRooms: item.isClosed ? 0 : availableRooms,
  };
};

// GET /api/vendor/villas/:villaId/rooms/:roomId/inventory
exports.getRoomInventory = async (req, res) => {
  try {
    const { villaId, roomId } = req.params;
    const { from, to } = req.query;

    if (!isValidId(villaId) || !isValidId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Valid villaId and roomId are required.",
      });
    }

    const filter = {
      villaId,
      roomId,
    };

    if (from || to) {
      const startDate = parseDate(from);
      const endDate = parseDate(to);

      if (!startDate || !endDate || startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: "Valid from and to dates are required.",
        });
      }

      filter.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const records = await VillaRoomInventory.find(filter)
      .sort({ date: 1 })
      .lean();

    return res.json({
      success: true,
      count: records.length,
      inventory: records.map(getAvailability),
    });
  } catch (error) {
    console.error("getRoomInventory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch room inventory.",
    });
  }
};

// POST /api/vendor/villas/:villaId/rooms/:roomId/inventory
exports.upsertRoomInventory = async (req, res) => {
  try {
    const { villaId, roomId } = req.params;
    const {
      date: dateValue,
      totalRooms,
      blockedRooms = 0,
      isClosed = false,
    } = req.body;

    if (!isValidId(villaId) || !isValidId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Valid villaId and roomId are required.",
      });
    }

    const date = parseDate(dateValue);

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date must be in YYYY-MM-DD format.",
      });
    }

    if (
      !Number.isInteger(totalRooms) ||
      totalRooms < 0 ||
      !Number.isInteger(blockedRooms) ||
      blockedRooms < 0 ||
      blockedRooms > totalRooms ||
      typeof isClosed !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid totalRooms, blockedRooms, or isClosed.",
      });
    }

    const existing = await VillaRoomInventory.findOne({
      villaId,
      roomId,
      date,
    });

    // Existing reservations must never be overwritten by inventory edits.
    const bookedRooms = existing ? existing.bookedRooms : 0;

    if (bookedRooms + blockedRooms > totalRooms) {
      return res.status(409).json({
        success: false,
        message: "Total rooms cannot be less than booked plus blocked rooms.",
      });
    }

    const availableRooms = isClosed
      ? 0
      : totalRooms - bookedRooms - blockedRooms;

    const record = await VillaRoomInventory.findOneAndUpdate(
      { villaId, roomId, date },
      {
        $set: {
          totalRooms,
          blockedRooms,
          isClosed,
          availableRooms,
        },
        $setOnInsert: {
          villaId,
          roomId,
          date,
          bookedRooms: 0,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing
        ? "Room inventory updated."
        : "Room inventory created.",
      inventory: getAvailability(record.toObject()),
    });
  } catch (error) {
    console.error("upsertRoomInventory:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Inventory already exists for this room and date. Retry.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save room inventory.",
    });
  }
};

// GET /api/vendor/villas/:villaId/rooms/:roomId/inventory/summary
exports.getRoomInventorySummary = async (req, res) => {
  try {
    const { villaId, roomId } = req.params;
    const { from, to } = req.query;

    if (!isValidId(villaId) || !isValidId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Valid villaId and roomId are required.",
      });
    }

    const startDate = parseDate(from);
    const endDate = parseDate(to);

    if (!startDate || !endDate || startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "Valid from and to dates are required.",
      });
    }

    const records = await VillaRoomInventory.find({
      villaId,
      roomId,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    const summary = records.reduce(
      (result, item) => {
        result.totalRooms += item.totalRooms;
        result.bookedRooms += item.bookedRooms;
        result.blockedRooms += item.blockedRooms;
        result.availableRoomNights += item.isClosed
          ? 0
          : Math.max(
              0,
              item.totalRooms - item.bookedRooms - item.blockedRooms
            );

        if (item.isClosed) result.closedDates += 1;
        return result;
      },
      {
        daysWithInventory: records.length,
        totalRooms: 0,
        bookedRooms: 0,
        blockedRooms: 0,
        availableRoomNights: 0,
        closedDates: 0,
      }
    );

    return res.json({ success: true, summary });
  } catch (error) {
    console.error("getRoomInventorySummary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory summary.",
    });
  }
};
