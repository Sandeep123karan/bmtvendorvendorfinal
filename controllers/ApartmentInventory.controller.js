// const Apartment = require("../models/Apartment.model");
// const Inventory = require("../models/ApartmentInventory.model");

// const DAY = 86400000;
// const MAX_DAYS = 366;

// /* ---------- helpers ---------- */
// const toDay = (s) => {
//   if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null;
//   const d = new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`);
//   return Number.isNaN(d.getTime()) ? null : d;
// };

// const eachDay = (from, to, weekdays) => {
//   const out = [];
//   for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
//     const d = new Date(t);
//     if (!weekdays || !weekdays.length || weekdays.includes(d.getUTCDay())) out.push(d);
//   }
//   return out;
// };

// const fail = (res, e) => {
//   console.error("APARTMENT INVENTORY ERROR:", e);
//   const code = e.name === "CastError" ? 400 : 500;
//   return res.status(code).json({ success: false, message: e.message });
// };

// // Sirf apni apartment (vendor check)
// const getOwnApartment = async (req, res) => {
//   const apt = await Apartment.findOne({
//     _id: req.params.apartmentId,
//     vendor: req.vendor._id,
//   });
//   if (!apt) {
//     res.status(404).json({ success: false, message: "Apartment not found" });
//     return null;
//   }
//   return apt;
// };

// const num = (v, { min = 0, int = true } = {}) => {
//   const n = Number(v);
//   if (Number.isNaN(n) || n < min || (int && !Number.isInteger(n))) return null;
//   return n;
// };

// /* =====================================================
//    LIST  GET /api/apartment-inventory/:apartmentId?from=YYYY-MM-DD&to=YYYY-MM-DD
// ===================================================== */
// exports.getInventory = async (req, res) => {
//   try {
//     const apt = await getOwnApartment(req, res);
//     if (!apt) return;

//     const today = toDay(new Date().toISOString());
//     const from = toDay(req.query.from) || today;
//     const to = toDay(req.query.to) || new Date(from.getTime() + 60 * DAY);

//     if (to < from || (to - from) / DAY + 1 > MAX_DAYS) {
//       return res.status(400).json({ success: false, message: `Date range max ${MAX_DAYS} din ki ho sakti hai` });
//     }

//     const rows = await Inventory.find({
//       apartment: apt._id,
//       date: { $gte: from, $lte: to },
//     }).sort({ date: 1 });

//     res.json({
//       success: true,
//       apartment: { _id: apt._id, apartmentName: apt.apartmentName, totalUnits: apt.totalUnits, basePrice: apt.pricing?.basePrice, status: apt.status },
//       data: rows,
//     });
//   } catch (e) {
//     fail(res, e);
//   }
// };

// /* =====================================================
//    BULK SET  POST /api/apartment-inventory/:apartmentId/bulk
//    body: { startDate, endDate, totalUnits?, blockedUnits?, price?, minNights?, stopSell?, weekdays?: [0-6] }
// ===================================================== */
// exports.bulkUpsert = async (req, res) => {
//   try {
//     const apt = await getOwnApartment(req, res);
//     if (!apt) return;

//     // Sirf approved apartment ki inventory (chaho to isko hata do)
//     if (apt.status !== "approved") {
//       return res.status(400).json({ success: false, message: "Inventory sirf approved apartment ki ban sakti hai" });
//     }

//     const b = req.body;
//     const from = toDay(b.startDate);
//     const to = toDay(b.endDate || b.startDate);
//     if (!from || !to || to < from) {
//       return res.status(400).json({ success: false, message: "Valid startDate / endDate do (YYYY-MM-DD)" });
//     }
//     if ((to - from) / DAY + 1 > MAX_DAYS) {
//       return res.status(400).json({ success: false, message: `Ek baar me max ${MAX_DAYS} din` });
//     }

//     const weekdays = Array.isArray(b.weekdays) ? b.weekdays.map(Number).filter((n) => n >= 0 && n <= 6) : null;

//     // fields validate
//     const set = {};
//     if (b.totalUnits !== undefined) {
//       const n = num(b.totalUnits);
//       if (n === null) return res.status(400).json({ success: false, message: "totalUnits galat hai" });
//       set.totalUnits = n;
//     }
//     if (b.blockedUnits !== undefined) {
//       const n = num(b.blockedUnits);
//       if (n === null) return res.status(400).json({ success: false, message: "blockedUnits galat hai" });
//       set.blockedUnits = n;
//     }
//     if (b.price !== undefined) {
//       if (b.price === null || b.price === "") set.price = null;
//       else {
//         const n = num(b.price, { int: false });
//         if (n === null) return res.status(400).json({ success: false, message: "price galat hai" });
//         set.price = n;
//       }
//     }
//     if (b.minNights !== undefined) {
//       const n = num(b.minNights, { min: 1 });
//       if (n === null) return res.status(400).json({ success: false, message: "minNights galat hai" });
//       set.minNights = n;
//     }
//     if (b.stopSell !== undefined) set.stopSell = b.stopSell === true || b.stopSell === "true";

//     if (Object.keys(set).length === 0) {
//       return res.status(400).json({ success: false, message: "Kuch to update karne ke liye bhejo" });
//     }

//     const days = eachDay(from, to, weekdays);
//     if (days.length === 0) {
//       return res.status(400).json({ success: false, message: "Is range me selected weekdays nahi mile" });
//     }

//     // booked units ke neeche total/blocked nahi jaa sakta
//     const existing = await Inventory.find({ apartment: apt._id, date: { $in: days } });
//     const conflicts = existing
//       .filter((d) => {
//         const t = set.totalUnits ?? d.totalUnits;
//         const bl = set.blockedUnits ?? d.blockedUnits;
//         return d.bookedUnits + bl > t;
//       })
//       .map((d) => d.date.toISOString().slice(0, 10));
//     if (conflicts.length) {
//       return res.status(409).json({
//         success: false,
//         message: "In dates par bookings pehle se hain, units itne kam nahi kar sakte",
//         dates: conflicts,
//       });
//     }
//     const effTotal = set.totalUnits ?? apt.totalUnits ?? 1;
//     if ((set.blockedUnits ?? 0) > effTotal) {
//       return res.status(400).json({ success: false, message: "blockedUnits, totalUnits se zyada nahi ho sakte" });
//     }

//     // naye din ke liye defaults
//     const defaults = {
//       totalUnits: apt.totalUnits || 1,
//       blockedUnits: 0,
//       price: null,
//       minNights: 1,
//       stopSell: false,
//     };
//     const onInsert = { vendor: req.vendor._id, bookedUnits: 0 };
//     Object.keys(defaults).forEach((k) => {
//       if (!(k in set)) onInsert[k] = defaults[k];
//     });

//     await Inventory.bulkWrite(
//       days.map((date) => ({
//         updateOne: {
//           filter: { apartment: apt._id, date },
//           update: { $set: set, $setOnInsert: onInsert },
//           upsert: true,
//         },
//       }))
//     );

//     res.json({ success: true, message: `${days.length} din ki inventory update ho gayi`, days: days.length });
//   } catch (e) {
//     fail(res, e);
//   }
// };

// /* =====================================================
//    SINGLE DAY  PATCH /api/apartment-inventory/:apartmentId/:date
// ===================================================== */
// exports.updateDay = (req, res) => {
//   req.body = { ...req.body, startDate: req.params.date, endDate: req.params.date };
//   return exports.bulkUpsert(req, res);
// };

// /* =====================================================
//    CLEAR RANGE  DELETE /api/apartment-inventory/:apartmentId?from=&to=
//    (jin dino par booking hai wo delete nahi honge)
// ===================================================== */
// exports.clearRange = async (req, res) => {
//   try {
//     const apt = await getOwnApartment(req, res);
//     if (!apt) return;

//     const from = toDay(req.query.from);
//     const to = toDay(req.query.to);
//     if (!from || !to || to < from) {
//       return res.status(400).json({ success: false, message: "from / to dates do" });
//     }

//     const r = await Inventory.deleteMany({
//       apartment: apt._id,
//       date: { $gte: from, $lte: to },
//       bookedUnits: 0,
//     });
//     res.json({ success: true, deleted: r.deletedCount });
//   } catch (e) {
//     fail(res, e);
//   }
// };

const Apartment = require("../models/Apartment.model");
const Inventory = require("../models/ApartmentInventory.model");

const DAY = 86400000;
const MAX_DAYS = 366;

/* ---------- helpers ---------- */
const toDay = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null;
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const eachDay = (from, to, weekdays) => {
  const out = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const d = new Date(t);
    if (!weekdays || !weekdays.length || weekdays.includes(d.getUTCDay())) out.push(d);
  }
  return out;
};

const fail = (res, e) => {
  console.error("APARTMENT INVENTORY ERROR:", e);
  const code = e.name === "CastError" ? 400 : 500;
  return res.status(code).json({ success: false, message: e.message });
};

// Sirf apni apartment (vendor check)
const getOwnApartment = async (req, res) => {
  const apt = await Apartment.findOne({
    _id: req.params.apartmentId,
    vendor: req.vendor._id,
  });
  if (!apt) {
    res.status(404).json({ success: false, message: "Apartment not found" });
    return null;
  }
  return apt;
};

const num = (v, { min = 0, int = true } = {}) => {
  const n = Number(v);
  if (Number.isNaN(n) || n < min || (int && !Number.isInteger(n))) return null;
  return n;
};

/* =====================================================
   LIST  GET /api/apartment-inventory/:apartmentId?from=YYYY-MM-DD&to=YYYY-MM-DD
===================================================== */
exports.getInventory = async (req, res) => {
  try {
    const apt = await getOwnApartment(req, res);
    if (!apt) return;

    const today = toDay(new Date().toISOString());
    const from = toDay(req.query.from) || today;
    const to = toDay(req.query.to) || new Date(from.getTime() + 60 * DAY);

    if (to < from || (to - from) / DAY + 1 > MAX_DAYS) {
      return res.status(400).json({ success: false, message: `Date range max ${MAX_DAYS} din ki ho sakti hai` });
    }

    const rows = await Inventory.find({
      apartment: apt._id,
      date: { $gte: from, $lte: to },
    }).sort({ date: 1 });

    res.json({
      success: true,
      apartment: {
        _id: apt._id,
        apartmentName: apt.apartmentName,
        totalUnits: apt.totalUnits,
        basePrice: apt.pricing?.basePrice,
        status: apt.status,
      },
      data: rows,
    });
  } catch (e) {
    fail(res, e);
  }
};

/* =====================================================
   BULK SET  POST /api/apartment-inventory/:apartmentId/bulk
   body: { startDate, endDate, totalUnits?, blockedUnits?, price?, minNights?, stopSell?, weekdays?: [0-6] }
   Approval ki koi condition nahi: vendor apni kisi bhi apartment ki inventory bana sakta hai
===================================================== */
exports.bulkUpsert = async (req, res) => {
  try {
    const apt = await getOwnApartment(req, res);
    if (!apt) return;

    const b = req.body;
    const from = toDay(b.startDate);
    const to = toDay(b.endDate || b.startDate);
    if (!from || !to || to < from) {
      return res.status(400).json({ success: false, message: "Valid startDate / endDate do (YYYY-MM-DD)" });
    }
    if ((to - from) / DAY + 1 > MAX_DAYS) {
      return res.status(400).json({ success: false, message: `Ek baar me max ${MAX_DAYS} din` });
    }

    const weekdays = Array.isArray(b.weekdays) ? b.weekdays.map(Number).filter((n) => n >= 0 && n <= 6) : null;

    // fields validate
    const set = {};
    if (b.totalUnits !== undefined) {
      const n = num(b.totalUnits);
      if (n === null) return res.status(400).json({ success: false, message: "totalUnits galat hai" });
      set.totalUnits = n;
    }
    if (b.blockedUnits !== undefined) {
      const n = num(b.blockedUnits);
      if (n === null) return res.status(400).json({ success: false, message: "blockedUnits galat hai" });
      set.blockedUnits = n;
    }
    if (b.price !== undefined) {
      if (b.price === null || b.price === "") set.price = null;
      else {
        const n = num(b.price, { int: false });
        if (n === null) return res.status(400).json({ success: false, message: "price galat hai" });
        set.price = n;
      }
    }
    if (b.minNights !== undefined) {
      const n = num(b.minNights, { min: 1 });
      if (n === null) return res.status(400).json({ success: false, message: "minNights galat hai" });
      set.minNights = n;
    }
    if (b.stopSell !== undefined) set.stopSell = b.stopSell === true || b.stopSell === "true";

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ success: false, message: "Kuch to update karne ke liye bhejo" });
    }

    const days = eachDay(from, to, weekdays);
    if (days.length === 0) {
      return res.status(400).json({ success: false, message: "Is range me selected weekdays nahi mile" });
    }

    // booked units ke neeche total/blocked nahi jaa sakta
    const existing = await Inventory.find({ apartment: apt._id, date: { $in: days } });
    const conflicts = existing
      .filter((d) => {
        const t = set.totalUnits ?? d.totalUnits;
        const bl = set.blockedUnits ?? d.blockedUnits;
        return d.bookedUnits + bl > t;
      })
      .map((d) => d.date.toISOString().slice(0, 10));
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: "In dates par bookings pehle se hain, units itne kam nahi kar sakte",
        dates: conflicts,
      });
    }

    // naye din (jinka record nahi hai) ke liye bhi blocked <= total
    const effTotal = set.totalUnits ?? apt.totalUnits ?? 1;
    if ((set.blockedUnits ?? 0) > effTotal) {
      return res.status(400).json({ success: false, message: "blockedUnits, totalUnits se zyada nahi ho sakte" });
    }

    // naye din ke liye defaults
    const defaults = {
      totalUnits: apt.totalUnits || 1,
      blockedUnits: 0,
      price: null,
      minNights: 1,
      stopSell: false,
    };
    const onInsert = { vendor: req.vendor._id, bookedUnits: 0 };
    Object.keys(defaults).forEach((k) => {
      if (!(k in set)) onInsert[k] = defaults[k];
    });

    await Inventory.bulkWrite(
      days.map((date) => ({
        updateOne: {
          filter: { apartment: apt._id, date },
          update: { $set: set, $setOnInsert: onInsert },
          upsert: true,
        },
      }))
    );

    res.json({ success: true, message: `${days.length} din ki inventory update ho gayi`, days: days.length });
  } catch (e) {
    fail(res, e);
  }
};

/* =====================================================
   SINGLE DAY  PATCH /api/apartment-inventory/:apartmentId/:date
===================================================== */
exports.updateDay = (req, res) => {
  req.body = { ...req.body, startDate: req.params.date, endDate: req.params.date };
  return exports.bulkUpsert(req, res);
};

/* =====================================================
   CLEAR RANGE  DELETE /api/apartment-inventory/:apartmentId?from=&to=
   (jin dino par booking hai wo delete nahi honge)
===================================================== */
exports.clearRange = async (req, res) => {
  try {
    const apt = await getOwnApartment(req, res);
    if (!apt) return;

    const from = toDay(req.query.from);
    const to = toDay(req.query.to);
    if (!from || !to || to < from) {
      return res.status(400).json({ success: false, message: "from / to dates do" });
    }

    const r = await Inventory.deleteMany({
      apartment: apt._id,
      date: { $gte: from, $lte: to },
      bookedUnits: 0,
    });
    res.json({ success: true, deleted: r.deletedCount });
  } catch (e) {
    fail(res, e);
  }
};