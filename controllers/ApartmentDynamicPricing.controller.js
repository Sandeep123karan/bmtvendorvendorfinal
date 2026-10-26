const mongoose = require("mongoose");
const Apartment = require("../models/Apartment.model");
const ApartmentRatePlan = require("../models/ApartmentRatePlan.model");
const ApartmentDynamicPricing = require("../models/ApartmentDynamicPricing.model");

const DAY = 86400000;
const MAX_SPAN = 731; // ek rule max 2 saal
const MAX_CAL_DAYS = 93;
const PRICING_TYPES = ["DATE_RANGE", "WEEKEND", "FESTIVAL", "PEAK_SEASON", "SPECIAL_EVENT"];

/* ---------- helpers (sab UTC, taaki din shift na ho) ---------- */
const toDay = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null;
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dayStr = (d) => new Date(d).toISOString().slice(0, 10);
const isWeekend = (d) => [5, 6].includes(d.getUTCDay()); // Fri + Sat

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });

const fail = (res, error, label) => {
  console.error(`${label}:`, error);
  const status = error.name === "CastError" || error.name === "ValidationError" ? 400 : 500;
  return bad(res, error.message, status);
};

const toBool = (v, d) =>
  v === undefined || v === null || v === "" ? d : v === true || String(v).toLowerCase() === "true";
const intOrNull = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

// apartment + rate plan dono vendor ke apne hone chahiye
const loadContext = async (req, res) => {
  const { apartmentId, ratePlanId } = req.params;
  if (!isId(apartmentId) || !isId(ratePlanId)) {
    bad(res, "Rate plan not found for this apartment.", 404);
    return null;
  }
  const apartment = await Apartment.findOne({
    _id: apartmentId,
    vendor: req.vendor._id,
    isDeleted: { $ne: true },
  });
  if (!apartment) {
    bad(res, "Apartment not found or access denied.", 404);
    return null;
  }
  const ratePlan = await ApartmentRatePlan.findOne({
    _id: ratePlanId,
    apartment: apartmentId,
    vendor: req.vendor._id,
  });
  if (!ratePlan) {
    bad(res, "Rate plan not found for this apartment.", 404);
    return null;
  }
  return { apartment, ratePlan };
};

// create + update dono ke liye ek hi validation
const parseRule = (b, base = {}) => {
  const pick = (k, d) => (b[k] !== undefined ? b[k] : base[k] !== undefined ? base[k] : d);

  const startDate = b.startDate !== undefined ? toDay(b.startDate) : base.startDate || null;
  const endDate = b.endDate !== undefined ? toDay(b.endDate) : base.endDate || null;
  if (!startDate || !endDate) return { error: "Valid startDate and endDate are required (YYYY-MM-DD)." };
  if (endDate < startDate) return { error: "endDate cannot be before startDate." };
  if ((endDate - startDate) / DAY + 1 > MAX_SPAN) return { error: `One rule can cover at most ${MAX_SPAN} days.` };

  const pricingType = pick("pricingType", "DATE_RANGE");
  if (!PRICING_TYPES.includes(pricingType)) return { error: "Invalid pricing type." };

  const title = String(pick("title", "") ?? "").trim();
  if (title.length > 80) return { error: "Title is too long (max 80 characters)." };

  const priceRaw = pick("price", "");
  if (priceRaw === "" || priceRaw === null || !Number.isFinite(Number(priceRaw)) || Number(priceRaw) < 0)
    return { error: "Valid price is required." };

  const minStay = intOrNull(pick("minStay", null));
  const maxStay = intOrNull(pick("maxStay", null));
  for (const [v, label] of [[minStay, "minStay"], [maxStay, "maxStay"]]) {
    if (v !== null && (!Number.isInteger(v) || v < 1)) return { error: `${label} must be a whole number, at least 1.` };
  }
  if (minStay !== null && maxStay !== null && minStay > maxStay)
    return { error: "minStay cannot be greater than maxStay." };

  const priority = Number(pick("priority", 1));
  if (!Number.isInteger(priority) || priority < 1 || priority > 100)
    return { error: "Priority must be a whole number from 1 to 100." };

  return {
    data: {
      startDate,
      endDate,
      pricingType,
      title,
      price: Number(priceRaw),
      minStay,
      maxStay,
      stopSell: toBool(pick("stopSell", false), false),
      priority,
      notes: String(pick("notes", "") ?? "").trim(),
    },
  };
};

/* =====================================================
   CREATE   POST /api/apartment-dynamic-pricing/apartment/:apartmentId/rate-plan/:ratePlanId
===================================================== */
exports.createDynamicPricing = async (req, res) => {
  try {
    const ctx = await loadContext(req, res);
    if (!ctx) return;

    const { data, error } = parseRule(req.body);
    if (error) return bad(res, error);

    const rule = await ApartmentDynamicPricing.create({
      vendor: req.vendor._id,
      apartment: ctx.apartment._id,
      ratePlan: ctx.ratePlan._id,
      ...data,
    });

    return res.status(201).json({ success: true, message: "Date price saved.", data: rule });
  } catch (error) {
    return fail(res, error, "CREATE DYNAMIC PRICING ERROR");
  }
};

/* =====================================================
   LIST   GET .../apartment/:apartmentId/rate-plan/:ratePlanId?startDate=&endDate=
===================================================== */
exports.getDynamicPricing = async (req, res) => {
  try {
    const ctx = await loadContext(req, res);
    if (!ctx) return;

    const filter = { apartment: ctx.apartment._id, ratePlan: ctx.ratePlan._id, vendor: req.vendor._id };

    const from = toDay(req.query.startDate);
    const to = toDay(req.query.endDate);
    if (from && to) {
      filter.startDate = { $lte: to };
      filter.endDate = { $gte: from };
    }

    const rules = await ApartmentDynamicPricing.find(filter).sort({ startDate: 1, priority: -1 });

    return res.json({ success: true, total: rules.length, data: rules });
  } catch (error) {
    return fail(res, error, "GET DYNAMIC PRICING ERROR");
  }
};

/* =====================================================
   PRICE CALENDAR   GET .../rate-plan/:ratePlanId/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
   Har din ka final price batata hai:
     1. active rule (sabse zyada priority, tie par latest updated)
     2. nahi to plan ka weekendPrice (Fri/Sat, agar set hai)
     3. nahi to plan ka basePrice
===================================================== */
exports.getPriceCalendar = async (req, res) => {
  try {
    const ctx = await loadContext(req, res);
    if (!ctx) return;

    const from = toDay(req.query.from);
    const to = toDay(req.query.to);
    if (!from || !to || to < from) return bad(res, "Valid from / to dates are required.");
    if ((to - from) / DAY + 1 > MAX_CAL_DAYS) return bad(res, `Range can be at most ${MAX_CAL_DAYS} days.`);

    const plan = ctx.ratePlan;

    const rules = await ApartmentDynamicPricing.find({
      apartment: ctx.apartment._id,
      ratePlan: plan._id,
      vendor: req.vendor._id,
      isActive: true,
      startDate: { $lte: to },
      endDate: { $gte: from },
    }).sort({ priority: -1, updatedAt: -1 });

    const data = [];
    for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
      const d = new Date(t);
      const weekend = isWeekend(d);

      const rule = rules.find(
        (r) => d >= r.startDate && d <= r.endDate && (r.pricingType !== "WEEKEND" || weekend)
      );

      const weekendPlanPrice = weekend && plan.weekendPrice > 0;

      data.push({
        date: dayStr(d),
        price: rule ? rule.price : weekendPlanPrice ? plan.weekendPrice : plan.basePrice,
        source: rule ? "rule" : weekendPlanPrice ? "weekend" : "base",
        stopSell: rule ? !!rule.stopSell : false,
        minStay: rule && rule.minStay !== null ? rule.minStay : plan.minStay,
        maxStay: rule && rule.maxStay !== null ? rule.maxStay : plan.maxStay,
        title: rule ? rule.title : "",
        ruleId: rule ? rule._id : null,
      });
    }

    return res.json({
      success: true,
      plan: {
        _id: plan._id,
        name: plan.name,
        code: plan.code,
        basePrice: plan.basePrice,
        weekendPrice: plan.weekendPrice,
        isActive: plan.isActive,
      },
      data,
    });
  } catch (error) {
    return fail(res, error, "PRICE CALENDAR ERROR");
  }
};

/* =====================================================
   UPDATE   PUT /api/apartment-dynamic-pricing/:pricingId
===================================================== */
exports.updateDynamicPricing = async (req, res) => {
  try {
    if (!isId(req.params.pricingId)) return bad(res, "Date price not found.", 404);
    const rule = await ApartmentDynamicPricing.findOne({ _id: req.params.pricingId, vendor: req.vendor._id });
    if (!rule) return bad(res, "Date price not found.", 404);

    const { data, error } = parseRule(req.body, rule.toObject());
    if (error) return bad(res, error);

    rule.set(data);
    await rule.save();

    return res.json({ success: true, message: "Date price updated.", data: rule });
  } catch (error) {
    return fail(res, error, "UPDATE DYNAMIC PRICING ERROR");
  }
};

/* =====================================================
   DELETE   DELETE /api/apartment-dynamic-pricing/:pricingId
===================================================== */
exports.deleteDynamicPricing = async (req, res) => {
  try {
    if (!isId(req.params.pricingId)) return bad(res, "Date price not found.", 404);
    const deleted = await ApartmentDynamicPricing.findOneAndDelete({
      _id: req.params.pricingId,
      vendor: req.vendor._id,
    });
    if (!deleted) return bad(res, "Date price not found.", 404);
    return res.json({ success: true, message: "Date price deleted." });
  } catch (error) {
    return fail(res, error, "DELETE DYNAMIC PRICING ERROR");
  }
};

/* =====================================================
   TOGGLE   PATCH /api/apartment-dynamic-pricing/:pricingId/toggle
===================================================== */
exports.toggleDynamicPricing = async (req, res) => {
  try {
    if (!isId(req.params.pricingId)) return bad(res, "Date price not found.", 404);
    const rule = await ApartmentDynamicPricing.findOne({ _id: req.params.pricingId, vendor: req.vendor._id });
    if (!rule) return bad(res, "Date price not found.", 404);

    rule.isActive = !rule.isActive;
    await rule.save();

    return res.json({
      success: true,
      message: rule.isActive ? "Date price activated." : "Date price deactivated.",
      data: rule,
    });
  } catch (error) {
    return fail(res, error, "TOGGLE DYNAMIC PRICING ERROR");
  }
};