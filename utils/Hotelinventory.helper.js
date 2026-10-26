// utils/hotelInventory.helper.js
// Shared helpers for HotelInventory + HotelBooking controllers

const HotelInventory = require("../models/HotelInventory.model");

const DAY = 24 * 60 * 60 * 1000;

/* ============================================================
   DATE HELPERS  (sab dates UTC midnight me store hoti hain,
   taaki server timezone (IST) ki wajah se date 1 din aage-peeche na ho jaye)
============================================================ */

// "2026-08-15" / ISO string / Date  ->  Date(2026-08-15T00:00:00.000Z)
const normalizeDate = (input) => {
  if (!input) return null;
  const s =
    input instanceof Date
      ? input.toISOString().slice(0, 10)
      : String(input).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const label = (d) => new Date(d).toISOString().slice(0, 10);

// checkIn se checkOut se pehle tak har raat ki date
const nightList = (checkIn, checkOut) => {
  const out = [];
  for (let t = checkIn.getTime(); t < checkOut.getTime(); t += DAY) {
    out.push(new Date(t));
  }
  return out;
};

// start se end tak (end included)
const dateRange = (start, end) => {
  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    out.push(new Date(t));
  }
  return out;
};

/* ============================================================
   ROOM DEFAULTS  (jis date ki inventory set nahi hai,
   uske liye room ki default values use hoti hain)
============================================================ */

const roomInventoryDefaults = (room) => ({
  hotel: room.hotel,
  vendor: room.vendor,

  totalRooms: room.totalRooms,
  bookedRooms: 0,
  blockedRooms: 0,
  availableRooms: room.totalRooms,

  stopSell: false,
  stopSellReason: "",
  status: "OPEN",
  isActive: true,

  basePrice: room.basePrice,
  offerPrice: room.offerPrice || 0,
  weekendPrice: room.weekendPrice || 0,
  holidayPrice: room.holidayPrice || 0,
  extraGuestCharge: room.extraGuestCharge || 0,
  taxPercentage: room.taxPercentage || 0,
  serviceChargePercentage: room.serviceChargePercentage || 0,

  mealPlan: room.mealPlan || "room-only",
  breakfastIncluded: !!room.breakfastIncluded,
  lunchIncluded: !!room.lunchIncluded,
  dinnerIncluded: !!room.dinnerIncluded,

  minimumStay: room.minimumStay || 1,
  maximumStay: room.maximumStay || 30,
  instantBooking: room.instantBooking !== false,

  refundable: room.refundable !== false,
  freeCancellation: !!room.freeCancellation,
  cancellationDeadlineHours: room.cancellationDeadlineHours ?? 24,
  cancellationPolicy: room.cancellationPolicy || "",
});

/* Inventory doc agar hai to wahi, warna default (DB me save nahi hota) */
const getInventoryOrDefault = async (room, date) => {
  const inv = await HotelInventory.findOne({ room: room._id, date }).lean();
  if (inv) return inv;
  return { ...roomInventoryDefaults(room), room: room._id, date, _virtual: true };
};

/* Inventory doc DB me guarantee se banata hai (race-safe) */
const ensureInventory = async (room, date) => {
  const filter = { room: room._id, date };
  try {
    return await HotelInventory.findOneAndUpdate(
      filter,
      { $setOnInsert: roomInventoryDefaults(room) },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err.code === 11000) return HotelInventory.findOne(filter);
    throw err;
  }
};

/* ============================================================
   RELEASE  (cancel par rooms wapas inventory me)
============================================================ */

const releaseInventory = async (roomId, dates, qty) => {
  for (const d of dates) {
    await HotelInventory.updateOne(
      { room: roomId, date: d, bookedRooms: { $gte: qty } },
      { $inc: { bookedRooms: -qty, availableRooms: qty } }
    );
  }
};

/* ============================================================
   DEDUCT  (booking confirm par inventory se kam)
   Har raat ke liye atomic update:
   availableRooms >= qty hona zaruri, warna poora rollback.
============================================================ */

const deductInventory = async (room, dates, qty) => {
  const done = [];

  for (const d of dates) {
    await ensureInventory(room, d);

    const updated = await HotelInventory.findOneAndUpdate(
      {
        room: room._id,
        date: d,
        isActive: true,
        stopSell: false,
        status: "OPEN",
        availableRooms: { $gte: qty },
      },
      { $inc: { bookedRooms: qty, availableRooms: -qty } },
      { new: true }
    );

    if (!updated) {
      // pehle jo dates kam ho chuki hain unhe wapas karo
      await releaseInventory(room._id, done, qty);

      const current = await HotelInventory.findOne({ room: room._id, date: d });

      const message =
        current && current.availableRooms < qty && !current.stopSell
          ? `Only ${current.availableRooms} room(s) available on ${label(d)}.`
          : `Room is not available for ${label(d)}.`;

      return { ok: false, message };
    }

    done.push(d);
  }

  return { ok: true };
};

module.exports = {
  DAY,
  normalizeDate,
  label,
  nightList,
  dateRange,
  roomInventoryDefaults,
  getInventoryOrDefault,
  ensureInventory,
  deductInventory,
  releaseInventory,
};