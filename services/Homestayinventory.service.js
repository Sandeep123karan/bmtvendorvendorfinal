const HomestayInventory = require("../models/HomestayInventory.model");
const { getStayDates, normalizeDate, dateKey, httpError } = require("../utils/Homestayhelpers");

/* units / isAvailable dobara calculate (aggregation pipeline stages) */
const recalcStages = [
  {
    $set: {
      availableUnits: {
        $max: [0, { $subtract: [{ $subtract: ["$totalUnits", "$bookedUnits"] }, "$blockedUnits"] }],
      },
    },
  },
  {
    $set: {
      isAvailable: {
        $and: [
          { $gt: ["$availableUnits", 0] },
          { $not: ["$isBlocked"] },
          { $not: ["$stopSell"] },
          { $not: ["$closedForBooking"] },
        ],
      },
    },
  },
];

/* delta > 0 : units book karo,  delta < 0 : units wapas karo */
const adjustPipeline = (delta) => [
  {
    $set: {
      bookedUnits: { $max: [0, { $add: [{ $ifNull: ["$bookedUnits", 0] }, delta] }] },
      totalBookings: {
        $max: [0, { $add: [{ $ifNull: ["$totalBookings", 0] }, delta > 0 ? 1 : -1] }],
      },
      lastUpdatedAt: "$$NOW",
    },
  },
  ...recalcStages,
];

const adjustDates = async (roomId, dates, delta) => {
  for (const date of dates) {
    await HomestayInventory.updateOne({ room: roomId, date }, adjustPipeline(delta), {
      updatePipeline: true,
    });
  }
};

/* ------------------------------------------------------------
   Inventory minus (har raat ke liye)
------------------------------------------------------------ */
const deductInventoryForBooking = async (booking) => {
  if (booking.inventoryDeducted) return;

  const dates = getStayDates(booking.checkInDate, booking.checkOutDate);
  const units = booking.unitsBooked || 1;
  const done = [];

  for (const date of dates) {
    const updated = await HomestayInventory.findOneAndUpdate(
      {
        room: booking.room,
        date,
        availableUnits: { $gte: units }, // atomic check: oversell nahi hoga
        isBlocked: false,
        stopSell: false,
        closedForBooking: false,
      },
      adjustPipeline(units),
      { new: true, updatePipeline: true }
    );

    if (!updated) {
      await adjustDates(booking.room, done, -units); // rollback
      throw httpError(
        409,
        `Room is no longer available for ${dateKey(date)}. Inventory changed or already booked.`
      );
    }
    done.push(date);
  }

  booking.inventoryDeducted = true;
};

/* ------------------------------------------------------------
   Inventory plus (cancel / reject)
------------------------------------------------------------ */
const restoreInventoryForBooking = async (booking) => {
  if (!booking.inventoryDeducted) return; // kabhi minus hi nahi hui

  const dates = getStayDates(booking.checkInDate, booking.checkOutDate);
  await adjustDates(booking.room, dates, -(booking.unitsBooked || 1));
  booking.inventoryDeducted = false;
};

/* ------------------------------------------------------------
   CONFIRM = status CONFIRMED + inventory minus (ek saath)
   Vendor confirm ya payment-success webhook dono yahi call karein.
------------------------------------------------------------ */
const confirmBookingWithInventory = async (booking) => {
  if (booking.bookingStatus !== "PENDING") {
    throw httpError(400, `Only pending bookings can be confirmed (current: ${booking.bookingStatus}).`);
  }

  await deductInventoryForBooking(booking);

  try {
    booking.bookingStatus = "CONFIRMED";
    booking.vendorConfirmation = "CONFIRMED";
    booking.vendorConfirmedAt = new Date();
    await booking.save();
  } catch (err) {
    await restoreInventoryForBooking(booking);
    throw err;
  }
};

/* Room ki totalRooms badle to aane wali dates ka totalUnits bhi update */
const syncRoomTotalUnits = async (room) => {
  const today = normalizeDate(new Date());
  await HomestayInventory.updateMany(
    { room: room._id, date: { $gte: today } },
    [{ $set: { totalUnits: room.totalRooms || 1 } }, ...recalcStages],
    { updatePipeline: true }
  );
};

module.exports = {
  deductInventoryForBooking,
  restoreInventoryForBooking,
  confirmBookingWithInventory,
  syncRoomTotalUnits,
};