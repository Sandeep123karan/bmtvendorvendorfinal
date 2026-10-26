const mongoose = require("mongoose");

const Hostel = require("../models/Hostel.model");
const HostelRoom = require("../models/HostelRoom.model");
const HostelBed = require("../models/HostelBed.model");
const { checkFiles, uploadMultipleFiles, cleanupUploadedAssets } = require("../utils/hostelMedia");

// =====================================================
// CONSTANTS & HELPERS
// =====================================================
const TYPES = [
  "Co-Living Hostel", "Student Hostel", "Backpacker Hostel", "Working Professionals Hostel",
  "Girls Hostel", "Boys Hostel", "Mixed Dormitory Hostel", "Other",
];
const GENDERS = ["Unisex", "Male", "Female"];
const POLICIES = ["Flexible", "Moderate", "Strict", "Non-refundable"];
const AMENITIES = [
  "Wi-Fi", "AC", "Attached Bathroom", "Laundry", "Parking", "CCTV", "Power Backup", "Housekeeping",
  "Common Kitchen", "Dining Area", "Study Area", "Locker", "Washing Machine", "Hot Water", "Gym", "Common Lounge",
];
const MAX_IMAGES = 30;
const MAX_DOCS = 10;

const getVendorId = (req) => {
  const id = req.vendor?._id || req.user?._id;
  return id && mongoose.isValidObjectId(id) ? id : null;
};

const getFiles = (req, name) => {
  if (Array.isArray(req.files)) return req.files.filter((f) => f.fieldname === name);
  if (req.files && Array.isArray(req.files[name])) return req.files[name];
  return [];
};

const checkCloudinary = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
    throw new Error("Cloudinary configuration is missing.");
};

const parseArray = (value, name) => {
  if (value === undefined || value === null || value === "") return [];
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { throw new Error(`${name} must be a valid JSON array.`); }
  }
  if (!Array.isArray(parsed)) throw new Error(`${name} must be an array.`);
  return parsed;
};

const optNumber = (value, name, min, max) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a valid number.`);
  if (min !== undefined && n < min) throw new Error(`${name} must be at least ${min}.`);
  if (max !== undefined && n > max) throw new Error(`${name} cannot exceed ${max}.`);
  return n;
};

const posInt = (value, name) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer.`);
  return n;
};

const checkTime = (value, name) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${name} must use HH:mm format.`);
  return value;
};

const makeSlug = (name) =>
  `${name}-${new mongoose.Types.ObjectId().toString().slice(-6)}`
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const toBool = (v) => v === true || v === "true";

// Validates only the fields that were sent; required fields must exist either in body or in the saved hostel.
const buildHostelData = (body, existing = {}) => {
  const d = {};

  ["hostelName", "description", "contactName", "contactPhone", "contactEmail", "address", "city", "state", "pincode"].forEach((f) => {
    if (body[f] === undefined) return;
    if (typeof body[f] !== "string") throw new Error(`${f} must be a string.`);
    d[f] = body[f].trim();
  });

  [["hostelType", TYPES], ["genderPreference", GENDERS], ["cancellationPolicy", POLICIES]].forEach(([f, list]) => {
    if (body[f] === undefined) return;
    if (!list.includes(body[f])) throw new Error(`Invalid ${f}.`);
    d[f] = body[f];
  });

  if (body.checkInTime !== undefined) d.checkInTime = checkTime(body.checkInTime, "checkInTime");
  if (body.checkOutTime !== undefined) d.checkOutTime = checkTime(body.checkOutTime, "checkOutTime");
  if (body.totalRooms !== undefined) d.totalRooms = posInt(body.totalRooms, "totalRooms");
  if (body.totalBeds !== undefined) d.totalBeds = posInt(body.totalBeds, "totalBeds");
  if (body.startingPrice !== undefined) d.startingPrice = optNumber(body.startingPrice, "startingPrice", 1);
  if (body.securityDeposit !== undefined) d.securityDeposit = optNumber(body.securityDeposit, "securityDeposit", 0) ?? 0;
  if (body.latitude !== undefined) d.latitude = optNumber(body.latitude, "latitude", -90, 90);
  if (body.longitude !== undefined) d.longitude = optNumber(body.longitude, "longitude", -180, 180);
  if (body.isActive !== undefined) d.isActive = toBool(body.isActive);

  if (body.amenities !== undefined) {
    const list = parseArray(body.amenities, "amenities");
    const bad = list.filter((a) => typeof a !== "string" || !AMENITIES.includes(a));
    if (bad.length) throw new Error(`Invalid amenities: ${bad.join(", ")}`);
    d.amenities = [...new Set(list)];
  }

  if (d.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contactEmail)) throw new Error("Please enter a valid contactEmail.");
  if (d.contactPhone) {
    const digits = d.contactPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) throw new Error("Please enter a valid contactPhone.");
  }
  if (d.pincode && !/^\d{6}$/.test(d.pincode)) throw new Error("pincode must contain exactly 6 digits.");

  ["hostelName", "description", "address", "city", "state", "pincode", "totalRooms", "totalBeds", "startingPrice"].forEach((f) => {
    const v = d[f] !== undefined ? d[f] : existing[f];
    if (v === undefined || v === null || v === "") throw new Error(`${f} is required.`);
  });

  return d;
};

// =====================================================
// CREATE   POST /api/vendor/hostels
// =====================================================
exports.createHostel = async (req, res) => {
  let uploaded = [];
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(401).json({ success: false, message: "Authenticated vendor not found." });

    checkCloudinary();

    const imageFiles = getFiles(req, "images");
    const docFiles = getFiles(req, "documents");
    checkFiles(imageFiles, MAX_IMAGES, "hostel media files");
    checkFiles(docFiles, MAX_DOCS, "documents");

    const data = buildHostelData(req.body);
    if (!imageFiles.length) return res.status(400).json({ success: false, message: "Please upload at least one hostel image." });

    const folder = `bmt/hostels/${vendorId}`;
    const images = await uploadMultipleFiles(imageFiles, folder);
    uploaded.push(...images);
    const documents = await uploadMultipleFiles(docFiles, `${folder}/documents`);
    uploaded.push(...documents);

    const hostel = await Hostel.create({
      ...data, vendorId, slug: makeSlug(data.hostelName), images, documents, isActive: data.isActive ?? true,
    });
    uploaded = [];

    return res.status(201).json({ success: true, message: "Hostel added successfully.", hostel });
  } catch (error) {
    await cleanupUploadedAssets(uploaded);
    console.error("createHostel:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to create hostel." });
  }
};

// =====================================================
// LIST   GET /api/vendor/hostels?page=&limit=
// =====================================================
exports.getMyHostels = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(401).json({ success: false, message: "Authenticated vendor not found." });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const filter = { vendorId };

    const [hostels, total] = await Promise.all([
      Hostel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Hostel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true, count: hostels.length, total, page, totalPages: Math.ceil(total / limit) || 1, hostels,
    });
  } catch (error) {
    console.error("getMyHostels:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch hostels." });
  }
};

// =====================================================
// SINGLE   GET /api/vendor/hostels/:hostelId
// =====================================================
exports.getHostelById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { hostelId } = req.params;
    if (!vendorId) return res.status(401).json({ success: false, message: "Authenticated vendor not found." });
    if (!mongoose.isValidObjectId(hostelId)) return res.status(400).json({ success: false, message: "Invalid hostel ID." });

    const hostel = await Hostel.findOne({ _id: hostelId, vendorId }).lean();
    if (!hostel) return res.status(404).json({ success: false, message: "Hostel not found." });

    return res.status(200).json({ success: true, hostel });
  } catch (error) {
    console.error("getHostelById:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch hostel details." });
  }
};

// =====================================================
// UPDATE   PUT /api/vendor/hostels/:hostelId
// Existing media stays unless its publicId is in removeImagePublicIds / removeDocumentPublicIds.
// =====================================================
exports.updateHostel = async (req, res) => {
  let uploaded = [];
  try {
    const vendorId = getVendorId(req);
    const { hostelId } = req.params;
    if (!vendorId) return res.status(401).json({ success: false, message: "Authenticated vendor not found." });
    if (!mongoose.isValidObjectId(hostelId)) return res.status(400).json({ success: false, message: "Invalid hostel ID." });

    checkCloudinary();

    const hostel = await Hostel.findOne({ _id: hostelId, vendorId });
    if (!hostel) return res.status(404).json({ success: false, message: "Hostel not found." });

    const imageFiles = getFiles(req, "images");
    const docFiles = getFiles(req, "documents");
    checkFiles(imageFiles, MAX_IMAGES, "hostel media files");
    checkFiles(docFiles, MAX_DOCS, "documents");

    const data = buildHostelData(req.body, hostel.toObject());

    const rmImages = parseArray(req.body.removeImagePublicIds, "removeImagePublicIds");
    const rmDocs = parseArray(req.body.removeDocumentPublicIds, "removeDocumentPublicIds");

    const imgIds = hostel.images.map((i) => i.publicId);
    const docIds = hostel.documents.map((d) => d.publicId);
    if (rmImages.some((id) => !imgIds.includes(id)) || rmDocs.some((id) => !docIds.includes(id)))
      throw new Error("One or more removal IDs do not belong to this hostel.");

    const keepImages = hostel.images.filter((i) => !rmImages.includes(i.publicId));
    const keepDocs = hostel.documents.filter((d) => !rmDocs.includes(d.publicId));
    const removed = [
      ...hostel.images.filter((i) => rmImages.includes(i.publicId)),
      ...hostel.documents.filter((d) => rmDocs.includes(d.publicId)),
    ];

    if (keepImages.length + imageFiles.length > MAX_IMAGES) throw new Error(`Maximum ${MAX_IMAGES} hostel media files are allowed.`);
    if (keepDocs.length + docFiles.length > MAX_DOCS) throw new Error(`Maximum ${MAX_DOCS} documents are allowed.`);
    if (!keepImages.length && !imageFiles.length) throw new Error("A hostel must have at least one image.");

    const folder = `bmt/hostels/${vendorId}`;
    const newImages = await uploadMultipleFiles(imageFiles, folder);
    uploaded.push(...newImages);
    const newDocs = await uploadMultipleFiles(docFiles, `${folder}/documents`);
    uploaded.push(...newDocs);

    Object.assign(hostel, data);
    hostel.images = [...keepImages, ...newImages];
    hostel.documents = [...keepDocs, ...newDocs];
    await hostel.save();
    uploaded = [];

    await cleanupUploadedAssets(removed); // only after the DB update succeeded

    return res.status(200).json({ success: true, message: "Hostel updated successfully.", hostel });
  } catch (error) {
    await cleanupUploadedAssets(uploaded);
    console.error("updateHostel:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to update hostel." });
  }
};

// =====================================================
// DELETE   DELETE /api/vendor/hostels/:hostelId
// Also removes the hostel's rooms, beds and their media (no orphans left behind).
// =====================================================
exports.deleteHostel = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { hostelId } = req.params;
    if (!vendorId) return res.status(401).json({ success: false, message: "Authenticated vendor not found." });
    if (!mongoose.isValidObjectId(hostelId)) return res.status(400).json({ success: false, message: "Invalid hostel ID." });

    const hostel = await Hostel.findOne({ _id: hostelId, vendorId });
    if (!hostel) return res.status(404).json({ success: false, message: "Hostel not found." });

    const rooms = await HostelRoom.find({ hostelId, vendorId }).select("_id images").lean();

    const Booking = mongoose.models.HostelBooking;
    if (Booking) {
      const busy = await Booking.exists({
        $or: [{ hostelId }, { roomId: { $in: rooms.map((r) => r._id) } }],
        bookingStatus: { $in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      });
      if (busy) return res.status(409).json({ success: false, message: "This hostel has active bookings and cannot be deleted." });
    }

    const assets = [...hostel.images, ...hostel.documents, ...rooms.flatMap((r) => r.images || [])];

    await HostelBed.deleteMany({ hostelId, vendorId });
    await HostelRoom.deleteMany({ hostelId, vendorId });
    await hostel.deleteOne();

    await cleanupUploadedAssets(assets);

    return res.status(200).json({ success: true, message: "Hostel deleted successfully." });
  } catch (error) {
    console.error("deleteHostel:", error);
    return res.status(500).json({ success: false, message: "Failed to delete hostel." });
  }
};