const mongoose = require("mongoose");
const VacationHouse = require("../models/vacationHouseModel");
const uploadModule = require("../utils/uploadToCloudinary");

/* utils file function ya object (named export) dono tarah export kar sakti hai */
const uploadToCloudinary =
  typeof uploadModule === "function"
    ? uploadModule
    : uploadModule?.uploadToCloudinary ||
      uploadModule?.uploadBufferToCloudinary ||
      uploadModule?.uploadBuffer ||
      uploadModule?.uploadImage ||
      uploadModule?.upload ||
      uploadModule?.default ||
      Object.values(uploadModule || {}).find((v) => typeof v === "function");

// Cloudinary result string ho ya object, dono se URL nikalta hai
const toUrl = (r) =>
  typeof r === "string" ? r : r?.secure_url || r?.url || r?.path || "";

/* =========================================================
   CONSTANTS + HELPERS
========================================================= */

const IMAGE_FIELDS = ["frontView", "bedRoom", "kitchen", "washroom"];
const DOC_FIELDS = [
  "propertyDocument",
  "ownerIdProof",
  "addressProof",
  "govtLicense",
];

const ok = (res, data, message = "OK", status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const serverError = (res, label, error) => {
  console.error(`${label} error:`, error);
  return fail(res, 500, error.message || "Something went wrong");
};

const isId = (id) => mongoose.Types.ObjectId.isValid(id);

// FormData se sab kuch string aata hai, isliye safe converters
const str = (v) =>
  v === undefined || v === null ? undefined : String(v).trim();

const num = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const bool = (v) => v === true || v === "true" || v === "1" || v === "on";

const parseList = (v) => {
  if (!v) return [];
  try {
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const validate = (b) => {
  if (!str(b.propertyName)) return "Property name is required";
  if (!str(b.city)) return "City is required";
  if (!str(b.state)) return "State is required";

  const base = num(b.basePrice);
  if (base === undefined || base < 0) return "Valid base price per night is required";

  if (!str(b.ownerName)) return "Owner name is required";

  const phoneDigits = String(b.phone || "").replace(/\D/g, "").length;
  if (phoneDigits < 10 || phoneDigits > 13) return "Valid owner phone number is required";

  if (str(b.email) && !/^\S+@\S+\.\S+$/.test(str(b.email))) {
    return "Enter a valid email address";
  }

  const star = num(b.starRating);
  if (star !== undefined && (star < 1 || star > 5)) {
    return "Star rating must be between 1 and 5";
  }

  return null;
};

// Files ko Cloudinary pe upload karke { fieldname: [urls] } return karta hai
const uploadFiles = async (files = []) => {
  const out = {};

  if (files.length && typeof uploadToCloudinary !== "function") {
    throw new Error(
      `utils/uploadToCloudinary me upload function nahi mila. Exports: [${Object.keys(
        uploadModule || {}
      ).join(", ")}]`
    );
  }

  for (const file of files) {
    if (![...IMAGE_FIELDS, ...DOC_FIELDS].includes(file.fieldname)) continue;
    if (!file.buffer) {
      throw new Error(
        "File buffer missing. middleware/upload me multer memoryStorage use karo."
      );
    }
    const url = toUrl(await uploadToCloudinary(file.buffer, "vacation-houses"));
    if (!url) throw new Error("Cloudinary upload failed: URL nahi mila");
    (out[file.fieldname] ||= []).push(url);
  }
  return out;
};

const buildFields = (b) => ({
  propertyName: str(b.propertyName),
  description: str(b.description) || "",
  shortDescription: str(b.shortDescription) || "",
  starRating: num(b.starRating),

  address: {
    street: str(b.street) || "",
    city: str(b.city),
    state: str(b.state),
    pincode: str(b.pincode) || "",
    latitude: num(b.latitude),
    longitude: num(b.longitude),
  },

  owner: {
    ownerName: str(b.ownerName),
    phone: str(b.phone),
    alternatePhone: str(b.alternatePhone) || "",
    email: str(b.email) || "",
  },

  pricing: {
    basePrice: num(b.basePrice),
    weekendPrice: num(b.weekendPrice),
    monthlyPrice: num(b.monthlyPrice),
    cleaningFee: num(b.cleaningFee),
    securityDeposit: num(b.securityDeposit),
  },

  checkInTime: str(b.checkInTime) || "",
  checkOutTime: str(b.checkOutTime) || "",
  petsAllowed: bool(b.petsAllowed),
  smokingAllowed: bool(b.smokingAllowed),
  cancellationPolicy: str(b.cancellationPolicy) || "",
  houseRules: str(b.houseRules) || "",
});

/* =========================================================
   ADD VACATION HOUSE         POST /add
========================================================= */
exports.addVacationHouse = async (req, res) => {
  try {
    const error = validate(req.body);
    if (error) return fail(res, 400, error);

    const up = await uploadFiles(req.files || []);

    const house = await VacationHouse.create({
      ...buildFields(req.body),
      images: Object.fromEntries(IMAGE_FIELDS.map((f) => [f, up[f] || []])),
      documents: Object.fromEntries(DOC_FIELDS.map((f) => [f, up[f] || []])),
      vendorId: req.vendor._id,
    });

    return ok(res, house, "Vacation house added successfully", 201);
  } catch (error) {
    return serverError(res, "addVacationHouse", error);
  }
};

/* =========================================================
   GET ALL HOUSES OF VENDOR   GET /my-houses
========================================================= */
exports.getVendorVacationHouses = async (req, res) => {
  try {
    const houses = await VacationHouse.find({ vendorId: req.vendor._id }).sort({
      createdAt: -1,
    });

    return res.json({ success: true, count: houses.length, data: houses });
  } catch (error) {
    return serverError(res, "getVendorVacationHouses", error);
  }
};

/* =========================================================
   GET SINGLE HOUSE           GET /:id
========================================================= */
exports.getSingleVacationHouse = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid house ID");

    const house = await VacationHouse.findOne({
      _id: req.params.id,
      vendorId: req.vendor._id,
    });

    if (!house) return fail(res, 404, "Vacation house not found");
    return ok(res, house);
  } catch (error) {
    return serverError(res, "getSingleVacationHouse", error);
  }
};

/* =========================================================
   UPDATE VACATION HOUSE      PUT /update/:id
   - saari fields update hoti hain
   - nayi files existing me add hoti hain
   - removeFiles = JSON array of URLs jo hatani hain
========================================================= */
exports.updateVacationHouse = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid house ID");

    const house = await VacationHouse.findOne({
      _id: req.params.id,
      vendorId: req.vendor._id,
    });
    if (!house) return fail(res, 404, "Vacation house not found");

    const error = validate(req.body);
    if (error) return fail(res, 400, error);

    house.set(buildFields(req.body));

    const toRemove = new Set(parseList(req.body.removeFiles));
    const up = await uploadFiles(req.files || []);

    IMAGE_FIELDS.forEach((f) => {
      const kept = (house.images?.[f] || []).filter((u) => !toRemove.has(u));
      house.set(`images.${f}`, [...kept, ...(up[f] || [])]);
    });

    DOC_FIELDS.forEach((f) => {
      const kept = (house.documents?.[f] || []).filter((u) => !toRemove.has(u));
      house.set(`documents.${f}`, [...kept, ...(up[f] || [])]);
    });

    await house.save();
    return ok(res, house, "Vacation house updated successfully");
  } catch (error) {
    return serverError(res, "updateVacationHouse", error);
  }
};

/* =========================================================
   DELETE VACATION HOUSE      DELETE /delete/:id
========================================================= */
exports.deleteVacationHouse = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid house ID");

    const house = await VacationHouse.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.vendor._id,
    });

    if (!house) return fail(res, 404, "Vacation house not found");
    return ok(res, null, "Vacation house deleted successfully");
  } catch (error) {
    return serverError(res, "deleteVacationHouse", error);
  }
};