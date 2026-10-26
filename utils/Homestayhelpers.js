// utils/homestayHelpers.js
// Inventory + Booking dono controllers/services yahin se helpers lete hain.
//
// IMPORTANT: saari dates UTC midnight par store hoti hain ("2026-08-15" -> 2026-08-15T00:00:00.000Z).
// Purane code me setHours() (local time) use ho raha tha, India (IST) me isse date ek din peeche
// chali jati thi. Ab sab kuch UTC me hai.

const DAY_MS = 24 * 60 * 60 * 1000;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const sendError = (res, err, fallback, label = "Error") => {
  if (err && err.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate record already exists." });
  }
  console.error(`${label}:`, err);
  return res.status(500).json({ success: false, message: fallback, error: err?.message });
};

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

const toNumber = (value, defaultValue = undefined) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  const n = Number(value);
  return Number.isNaN(n) ? defaultValue : n;
};

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0) return false;
  return defaultValue;
};

const normalizeDate = (value) => {
  if (!value) return null;
  let d;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const dateKey = (value) => {
  const d = normalizeDate(value);
  return d ? d.toISOString().slice(0, 10) : null;
};

/* start..end dono included (inventory range ke liye) */
const getDateRange = (startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start || !end || start > end) return [];
  const dates = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) dates.push(new Date(t));
  return dates;
};

/* check-in included, check-out EXCLUDED (har raat ki date) */
const getStayDates = (checkIn, checkOut) => {
  const start = normalizeDate(checkIn);
  const end = normalizeDate(checkOut);
  if (!start || !end || end <= start) return [];
  const dates = [];
  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) dates.push(new Date(t));
  return dates;
};

const calculateNights = (checkIn, checkOut) => getStayDates(checkIn, checkOut).length;

const getDayType = (date) => {
  const day = normalizeDate(date).getUTCDay(); // 0 = Sun, 6 = Sat
  return day === 0 || day === 6 ? "weekend" : "weekday";
};

module.exports = {
  httpError,
  sendError,
  round,
  toNumber,
  toBoolean,
  normalizeDate,
  dateKey,
  getDateRange,
  getStayDates,
  calculateNights,
  getDayType,
};