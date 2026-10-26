const mongoose = require("mongoose");
const Apartment = require("../models/Apartment.model");
const ApartmentRatePlan = require("../models/ApartmentRatePlan.model");
const ApartmentDynamicPricing = require("../models/ApartmentDynamicPricing.model");

const MEAL_PLANS = ["ROOM_ONLY", "BREAKFAST", "BREAKFAST_DINNER", "ALL_MEALS"];
const CHARGE_TYPES = ["NONE", "PERCENTAGE", "FIXED", "ONE_NIGHT"];

/* ---------- helpers ---------- */
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });

const fail = (res, error, label) => {
  console.error(`${label}:`, error);
  if (error.code === 11000) return bad(res, "Rate plan code already exists for this apartment.", 409);
  const status = error.name === "CastError" || error.name === "ValidationError" ? 400 : 500;
  return bad(res, error.message, status);
};

const getOwnApartment = async (apartmentId, vendorId) => {
  if (!isId(apartmentId)) return null;
  return Apartment.findOne({ _id: apartmentId, vendor: vendorId, isDeleted: { $ne: true } });
};

const optNum = (v, d) => (v === undefined || v === null || v === "" ? d : Number(v));
const toBool = (v, d) =>
  v === undefined || v === null || v === "" ? d : v === true || String(v).toLowerCase() === "true";

// body + (update ke time) purane plan ko merge karke ek clean object banata hai
const mergePlan = (b, base = {}) => {
  const pick = (k, d) => (b[k] !== undefined ? b[k] : base[k] !== undefined ? base[k] : d);
  return {
    name: String(pick("name", "") ?? "").trim(),
    code: String(pick("code", "") ?? "").trim().toUpperCase(),
    description: String(pick("description", "") ?? "").trim(),
    mealPlan: pick("mealPlan", "ROOM_ONLY"),
    basePrice: pick("basePrice", ""),
    weekendPrice: optNum(pick("weekendPrice", 0), 0),
    extraAdultPrice: optNum(pick("extraAdultPrice", 0), 0),
    extraChildPrice: optNum(pick("extraChildPrice", 0), 0),
    extraMattressPrice: optNum(pick("extraMattressPrice", 0), 0),
    gstPercentage: optNum(pick("gstPercentage", 0), 0),
    refundable: toBool(pick("refundable", true), true),
    cancellationHours: optNum(pick("cancellationHours", 24), 24),
    cancellationChargeType: pick("cancellationChargeType", "NONE"),
    cancellationChargeValue: optNum(pick("cancellationChargeValue", 0), 0),
    minStay: optNum(pick("minStay", 1), 1),
    maxStay: optNum(pick("maxStay", 30), 30),
    minAdvanceBookingHours: optNum(pick("minAdvanceBookingHours", 0), 0),
    maxAdvanceBookingDays: optNum(pick("maxAdvanceBookingDays", 365), 365),
  };
};

const validatePlan = (m) => {
  if (!m.name) return "Rate plan name is required.";
  if (m.name.length > 100) return "Rate plan name is too long (max 100).";
  if (!/^[A-Z0-9_-]{2,20}$/.test(m.code)) return "Code must be 2 to 20 characters: letters, numbers, - or _.";
  if (!MEAL_PLANS.includes(m.mealPlan)) return "Invalid meal plan.";
  if (m.basePrice === "" || m.basePrice === null || !Number.isFinite(Number(m.basePrice)) || Number(m.basePrice) < 0)
    return "Valid basePrice is required.";

  const nonNeg = [
    ["weekendPrice", "Weekend price"],
    ["extraAdultPrice", "Extra adult price"],
    ["extraChildPrice", "Extra child price"],
    ["extraMattressPrice", "Extra mattress price"],
    ["cancellationHours", "Cancellation hours"],
    ["cancellationChargeValue", "Cancellation charge"],
    ["minAdvanceBookingHours", "Minimum advance booking hours"],
  ];
  for (const [k, label] of nonNeg) {
    if (!Number.isFinite(m[k]) || m[k] < 0) return `${label} cannot be negative.`;
  }
  if (!Number.isFinite(m.gstPercentage) || m.gstPercentage < 0 || m.gstPercentage > 100)
    return "GST must be between 0 and 100.";
  if (!CHARGE_TYPES.includes(m.cancellationChargeType)) return "Invalid cancellation charge type.";
  if (m.cancellationChargeType === "PERCENTAGE" && m.cancellationChargeValue > 100)
    return "Cancellation percentage cannot be more than 100.";
  for (const [k, label] of [["minStay", "Minimum stay"], ["maxStay", "Maximum stay"], ["maxAdvanceBookingDays", "Maximum advance booking days"]]) {
    if (!Number.isInteger(m[k]) || m[k] < 1) return `${label} must be a whole number, at least 1.`;
  }
  if (m.minStay > m.maxStay) return "minStay cannot be greater than maxStay.";
  return null;
};

const finalize = (m) => ({ ...m, basePrice: Number(m.basePrice) });

/* =====================================================
   CREATE   POST /api/apartment-rate-plans/apartment/:apartmentId
===================================================== */
exports.createRatePlan = async (req, res) => {
  try {
    const apartment = await getOwnApartment(req.params.apartmentId, req.vendor._id);
    if (!apartment) return bad(res, "Apartment not found or access denied.", 404);

    const m = mergePlan(req.body);
    const problem = validatePlan(m);
    if (problem) return bad(res, problem);

    const exists = await ApartmentRatePlan.findOne({ apartment: apartment._id, code: m.code });
    if (exists) return bad(res, "Rate plan code already exists for this apartment.", 409);

    const plan = await ApartmentRatePlan.create({
      vendor: req.vendor._id,
      apartment: apartment._id,
      ...finalize(m),
    });

    return res.status(201).json({ success: true, message: "Rate plan created.", data: plan });
  } catch (error) {
    return fail(res, error, "CREATE RATE PLAN ERROR");
  }
};

/* =====================================================
   LIST   GET /api/apartment-rate-plans/apartment/:apartmentId
   Har plan ke saath `rulesCount` (date-wise price rules) bhi aata hai
===================================================== */
exports.getRatePlans = async (req, res) => {
  try {
    const apartment = await getOwnApartment(req.params.apartmentId, req.vendor._id);
    if (!apartment) return bad(res, "Apartment not found.", 404);

    const [plans, counts] = await Promise.all([
      ApartmentRatePlan.find({ apartment: apartment._id, vendor: req.vendor._id }).sort({ createdAt: -1 }),
      ApartmentDynamicPricing.aggregate([
        { $match: { apartment: apartment._id, vendor: req.vendor._id } },
        { $group: { _id: "$ratePlan", count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = {};
    counts.forEach((c) => { countMap[String(c._id)] = c.count; });

    const data = plans.map((p) => ({ ...p.toObject(), rulesCount: countMap[String(p._id)] || 0 }));

    return res.json({ success: true, total: data.length, data });
  } catch (error) {
    return fail(res, error, "GET RATE PLANS ERROR");
  }
};

/* =====================================================
   SINGLE   GET /api/apartment-rate-plans/:ratePlanId
===================================================== */
exports.getRatePlanById = async (req, res) => {
  try {
    if (!isId(req.params.ratePlanId)) return bad(res, "Rate plan not found.", 404);
    const plan = await ApartmentRatePlan.findOne({ _id: req.params.ratePlanId, vendor: req.vendor._id });
    if (!plan) return bad(res, "Rate plan not found.", 404);
    return res.json({ success: true, data: plan });
  } catch (error) {
    return fail(res, error, "GET RATE PLAN ERROR");
  }
};

/* =====================================================
   UPDATE   PUT /api/apartment-rate-plans/:ratePlanId
   Sirf allowed fields update hote hain (vendor / apartment kabhi nahi)
===================================================== */
exports.updateRatePlan = async (req, res) => {
  try {
    if (!isId(req.params.ratePlanId)) return bad(res, "Rate plan not found.", 404);
    const plan = await ApartmentRatePlan.findOne({ _id: req.params.ratePlanId, vendor: req.vendor._id });
    if (!plan) return bad(res, "Rate plan not found.", 404);

    const m = mergePlan(req.body, plan.toObject());
    const problem = validatePlan(m);
    if (problem) return bad(res, problem);

    const duplicate = await ApartmentRatePlan.findOne({
      apartment: plan.apartment,
      code: m.code,
      _id: { $ne: plan._id },
    });
    if (duplicate) return bad(res, "Rate plan code already exists for this apartment.", 409);

    plan.set(finalize(m));
    await plan.save();

    return res.json({ success: true, message: "Rate plan updated.", data: plan });
  } catch (error) {
    return fail(res, error, "UPDATE RATE PLAN ERROR");
  }
};

/* =====================================================
   DELETE   DELETE /api/apartment-rate-plans/:ratePlanId
   Plan ke saath uske date-wise price rules bhi hat jate hain
===================================================== */
exports.deleteRatePlan = async (req, res) => {
  try {
    if (!isId(req.params.ratePlanId)) return bad(res, "Rate plan not found.", 404);
    const plan = await ApartmentRatePlan.findOneAndDelete({ _id: req.params.ratePlanId, vendor: req.vendor._id });
    if (!plan) return bad(res, "Rate plan not found.", 404);

    await ApartmentDynamicPricing.deleteMany({ ratePlan: plan._id, vendor: req.vendor._id });

    return res.json({ success: true, message: "Rate plan deleted." });
  } catch (error) {
    return fail(res, error, "DELETE RATE PLAN ERROR");
  }
};

/* =====================================================
   TOGGLE   PATCH /api/apartment-rate-plans/:ratePlanId/toggle
===================================================== */
exports.toggleRatePlan = async (req, res) => {
  try {
    if (!isId(req.params.ratePlanId)) return bad(res, "Rate plan not found.", 404);
    const plan = await ApartmentRatePlan.findOne({ _id: req.params.ratePlanId, vendor: req.vendor._id });
    if (!plan) return bad(res, "Rate plan not found.", 404);

    plan.isActive = !plan.isActive;
    await plan.save();

    return res.json({
      success: true,
      message: plan.isActive ? "Rate plan activated." : "Rate plan deactivated.",
      data: plan,
    });
  } catch (error) {
    return fail(res, error, "TOGGLE RATE PLAN ERROR");
  }
};