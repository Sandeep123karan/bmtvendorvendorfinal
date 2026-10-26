
// const Vendor = require("../models/Vendor.model");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");

// const MAIN_VERTICALS = [
//   "stay",
//   "bus",
//   "cab",
//   "packages",
//   "activities",
//   "events",
//   "darshan",
//   "cruise",
// ];

// const STAY_SUBTYPES = [
//   "hotel",
//   "homestay",
//   "resort",
//   "villa",
//   "apartment",
//   "guesthouse",
//   "hostel",
//   "camp",
//   "campsite",
//   "farmhouse",
//   "vacation-home",
//   "palace",
//   "motel",
//   "bnb",
//   "lodge",
//   "inn",
//   "serviced-apartment",
// ];

// /* ==========================================================
//    BASIC HELPERS
// ========================================================== */

// const normalizeString = (value) => {
//   if (value === undefined || value === null) {
//     return "";
//   }

//   return String(value).trim();
// };

// const normalizeEmail = (value) => normalizeString(value).toLowerCase();

// const normalizePhone = (value) =>
//   normalizeString(value).replace(/[^\d+]/g, "");

// const normalizeSlug = (value) =>
//   normalizeString(value)
//     .toLowerCase()
//     .replace(/&/g, "and")
//     .replace(/\//g, " ")
//     .replace(/_/g, " ")
//     .replace(/[^a-z0-9]+/g, "-")
//     .replace(/^-+|-+$/g, "");

// /* ==========================================================
//    VERTICAL DETAILS
//    (Cruise / Tours / Activities / Events / Darshan)

//    Frontend sends one details object per vertical:
//      cruise     -> cruiseDetails
//      packages   -> packageDetails
//      activities -> activityDetails
//      events     -> eventDetails
//      darshan    -> darshanDetails

//    Stay / Bus / Cab keep their existing flows.
// ========================================================== */

// const DETAILS_KEY = {
//   cruise: "cruiseDetails",
//   packages: "packageDetails",
//   activities: "activityDetails",
//   events: "eventDetails",
//   darshan: "darshanDetails",
// };

// /*
//   [path, label, mustBePositive]
//   Path uses dot notation: "policies.cancellation"
// */
// const REQUIRED_RULES = {
//   cruise: [
//     ["cruiseOperatorName", "Cruise operator name"],
//     ["cruiseLineName", "Cruise line name"],
//     ["cruiseType", "Cruise type"],
//     ["cruiseOperatorType", "Operator type"],
//     ["vesselType", "Vessel type"],
//     ["cruiseCategory", "Service category"],
//     ["shipName", "Ship name"],
//     ["passengerCapacity", "Passenger capacity", true],
//     ["numberOfCabins", "Total cabins", true],
//     ["cabinTypes", "Cabin types"],
//     ["departurePort", "Departure port"],
//     ["destinationPort", "Destination"],
//     ["cruiseDuration", "Cruise duration"],
//     ["amenities", "Cruise amenities"],
//     ["policies.cancellation", "Cancellation policy"],
//     ["policies.refund", "Refund policy"],
//     ["policies.child", "Child policy"],
//     ["policies.baggage", "Baggage policy"],
//     ["policies.passportVisa", "Passport / visa requirements"],
//     ["policies.checkIn", "Check-in / boarding policy"],
//   ],

//   packages: [
//     ["classification.operatingRegion", "Operating region"],
//     ["classification.packageCategories", "Package categories"],
//     ["classification.destinationsCovered", "Destinations covered"],
//     ["inventory.activePackages", "Number of active packages"],
//     ["amenities.services", "Services offered"],
//     ["policies.cancellationPolicy", "Cancellation policy"],
//     ["policies.refundPolicy", "Refund policy"],
//     ["media.propertyImages", "Tour images"],
//   ],

//   activities: [
//     ["classification.activityCategories", "Activity categories"],
//     ["classification.difficultyLevel", "Difficulty level"],
//     ["inventory.totalActivities", "Number of activities"],
//     ["inventory.maxParticipantsPerSlot", "Max participants per slot"],
//     ["amenities.facilities", "Facilities"],
//     ["policies.cancellationPolicy", "Cancellation policy"],
//     ["policies.refundPolicy", "Refund policy"],
//     ["policies.safetyRules", "Safety rules"],
//     ["media.propertyImages", "Activity images"],
//   ],

//   events: [
//     ["classification.eventCategories", "Event categories"],
//     ["classification.venueType", "Venue type"],
//     ["classification.ageRestriction", "Age restriction"],
//     ["inventory.venueCapacity", "Maximum capacity"],
//     ["amenities.facilities", "Facilities"],
//     ["policies.cancellationPolicy", "Cancellation policy"],
//     ["policies.refundPolicy", "Refund policy"],
//     ["policies.entryPolicy", "Entry policy"],
//     ["media.propertyImages", "Event images"],
//   ],

//   darshan: [
//     ["basic.mainDeity", "Main deity / place of worship"],
//     ["basic.tradition", "Tradition"],
//     ["classification.placeType", "Type of place"],
//     ["classification.serviceCategories", "Services offered"],
//     ["inventory.openingTime", "Opening time"],
//     ["inventory.closingTime", "Closing time"],
//     ["inventory.dailyCapacity", "Daily darshan capacity"],
//     ["amenities.facilities", "Facilities"],
//     ["policies.cancellationPolicy", "Cancellation policy"],
//     ["policies.refundPolicy", "Refund policy"],
//     ["policies.dressCode", "Dress code"],
//     ["media.propertyImages", "Images"],
//   ],
// };

// /* Removes "$where", "a.b", "__proto__" style keys (NoSQL injection guard). */
// const sanitizeDetails = (value) => {
//   if (Array.isArray(value)) {
//     return value.map(sanitizeDetails);
//   }

//   if (value && typeof value === "object") {
//     const clean = {};

//     Object.entries(value).forEach(([key, val]) => {
//       if (
//         key.startsWith("$") ||
//         key.includes(".") ||
//         key === "__proto__" ||
//         key === "constructor" ||
//         key === "prototype"
//       ) {
//         return;
//       }

//       clean[key] = sanitizeDetails(val);
//     });

//     return clean;
//   }

//   return value;
// };

// const getPath = (obj, path) =>
//   path
//     .split(".")
//     .reduce(
//       (acc, key) => (acc === undefined || acc === null ? undefined : acc[key]),
//       obj
//     );

// const isBlank = (value) => {
//   if (value === undefined || value === null) return true;
//   if (Array.isArray(value)) return value.length === 0;
//   if (typeof value === "string") return value.trim() === "";
//   return false;
// };

// /*
//   returns
//     { details: { cruiseDetails: {...} }, error: "" }
//     { details: {}, error: "Cruise line name is required." }
// */
// const prepareVerticalDetails = (body, vertical) => {
//   const key = DETAILS_KEY[vertical];

//   // stay / bus / cab: not handled here
//   if (!key) {
//     return { details: {}, error: "" };
//   }

//   const raw = body?.[key];

//   if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
//     return {
//       details: {},
//       error: `${key} is required for the ${vertical} vertical.`,
//     };
//   }

//   const details = sanitizeDetails(raw);

//   for (const [path, label, positive] of REQUIRED_RULES[vertical] || []) {
//     const value = getPath(details, path);

//     if (isBlank(value)) {
//       return { details: {}, error: `${label} is required.` };
//     }

//     if (positive && !(Number(value) > 0)) {
//       return { details: {}, error: `${label} must be greater than 0.` };
//     }
//   }

//   return { details: { [key]: details }, error: "" };
// };

// /* Whatever vertical details exist on a vendor document. */
// const pickVerticalDetails = (vendor) => {
//   const source =
//     typeof vendor.toObject === "function" ? vendor.toObject() : vendor;

//   const out = {};

//   Object.values(DETAILS_KEY).forEach((key) => {
//     if (source[key]) {
//       out[key] = source[key];
//     }
//   });

//   return out;
// };

// /* ==========================================================
//    BUSINESS TYPE NORMALIZER
// ========================================================== */

// const normalizeBusinessType = (value) => {
//   if (!value) {
//     return "";
//   }

//   const raw = normalizeSlug(value);

//   const aliases = {
//     individual: "individual",
//     "individual-owner": "individual-owner",
//     "sole-proprietorship": "sole-proprietorship",
//     proprietorship: "proprietorship",
//     partnership: "partnership",
//     llp: "llp",
//     company: "company",
//     corporation: "corporation",
//     "private-company": "private-limited",
//     "private-limited-company": "private-limited",
//     "private-limited": "private-limited",
//     "public-company": "public-limited",
//     "public-limited-company": "public-limited",
//     "public-limited": "public-limited",
//     agency: "agency",
//     "travel-agency": "agency",
//     "tour-operator": "tour-operator",
//     dmc: "dmc",
//     "destination-management-company": "dmc",
//     "property-group": "hotel-property-group",
//     "hotel-group": "hotel-property-group",
//     "hotel-property-group": "hotel-property-group",
//     "transport-operator": "transport-operator",
//     "bus-operator": "bus-operator",
//     "fleet-owner": "fleet-owner",
//     "activity-operator": "activity-operator",
//     "event-organizer": "event-organizer",
//     "cruise-operator": "cruise-operator",
//     "religious-temple-trust": "religious-darshan-operator",
//     "religious-darshan-operator": "religious-darshan-operator",
//     "darshan-operator": "religious-darshan-operator",
//     "non-profit-foundation": "non-profit",
//     "non-profit": "non-profit",
//     government: "government",
//     "government-public-authority": "government",
//     other: "other",
//   };

//   return aliases[raw] || "";
// };

// /* ==========================================================
//    VERTICAL NORMALIZER
// ========================================================== */

// const normalizeVertical = (value) => {
//   const raw = normalizeSlug(value);

//   const aliases = {
//     stay: "stay",
//     stays: "stay",
//     accommodation: "stay",
//     accommodations: "stay",

//     hotel: "stay",
//     homestay: "stay",
//     resort: "stay",
//     villa: "stay",
//     apartment: "stay",
//     guesthouse: "stay",
//     hostel: "stay",
//     camp: "stay",
//     campsite: "stay",
//     farmhouse: "stay",
//     "vacation-home": "stay",
//     palace: "stay",
//     motel: "stay",
//     bnb: "stay",
//     lodge: "stay",
//     inn: "stay",
//     "serviced-apartment": "stay",

//     bus: "bus",
//     buses: "bus",

//     cab: "cab",
//     cabs: "cab",
//     taxi: "cab",
//     "car-rental": "cab",

//     package: "packages",
//     packages: "packages",
//     holiday: "packages",
//     holidays: "packages",
//     tour: "packages",
//     tours: "packages",

//     activity: "activities",
//     activities: "activities",
//     experience: "activities",
//     experiences: "activities",

//     event: "events",
//     events: "events",
//     nightlife: "events",
//     nightclub: "events",

//     darshan: "darshan",
//     religious: "darshan",
//     temple: "darshan",

//     cruise: "cruise",
//     cruises: "cruise",
//   };

//   return aliases[raw] || "";
// };

// /* ==========================================================
//    STAY SUBTYPE NORMALIZER
// ========================================================== */

// const normalizeStaySubtype = (value) => {
//   const raw = normalizeSlug(value);

//   const aliases = {
//     hotel: "hotel",
//     homestay: "homestay",
//     resort: "resort",
//     villa: "villa",
//     apartment: "apartment",
//     "serviced-apartment": "serviced-apartment",
//     guesthouse: "guesthouse",
//     "guest-house": "guesthouse",
//     hostel: "hostel",
//     camp: "camp",
//     campsite: "campsite",
//     "camp-site": "campsite",
//     farmhouse: "farmhouse",
//     "farm-house": "farmhouse",
//     "vacation-home": "vacation-home",
//     "vacation-house": "vacation-home",
//     palace: "palace",
//     motel: "motel",
//     bnb: "bnb",
//     "bed-and-breakfast": "bnb",
//     lodge: "lodge",
//     inn: "inn",
//   };

//   const subtype = aliases[raw] || "";

//   return STAY_SUBTYPES.includes(subtype) ? subtype : "";
// };

// /* ==========================================================
//    LEGACY SERVICE VALUES

//    IMPORTANT: Parent "stay" is NOT stored in services[].

//    Example:
//    vertical         = "stay"
//    selectedVertical = "stay"
//    staySubtype      = "hotel"
//    service          = "hotel"
//    services         = ["hotel"]
// ========================================================== */

// const LEGACY_SERVICES = new Set([
//   "hotel",
//   "homestay",
//   "resort",
//   "villa",
//   "apartment",
//   "guesthouse",
//   "hostel",
//   "camp",
//   "campsite",
//   "farmhouse",
//   "vacation-home",
//   "palace",
//   "motel",
//   "bnb",
//   "lodge",
//   "inn",
//   "serviced-apartment",

//   "cab",
//   "car-rental",
//   "bike-rental",

//   "bus",

//   "holiday-package",
//   "packages",

//   "activities",

//   "events",
//   "night-club",

//   "BMT Darshan",
//   "darshan",

//   "cruise",

//   "visa",
//   "travel-insurance",

//   "other",
// ]);

// const normalizeLegacyService = (value) => {
//   if (!value) {
//     return "";
//   }

//   const original = normalizeString(value);

//   if (original === "BMT Darshan") {
//     return "BMT Darshan";
//   }

//   const raw = normalizeSlug(original);

//   // Parent Stay must never be saved in legacy services array.
//   if (raw === "stay" || raw === "stays" || raw === "accommodation") {
//     return "";
//   }

//   const aliases = {
//     hotel: "hotel",
//     homestay: "homestay",
//     resort: "resort",
//     villa: "villa",
//     apartment: "apartment",
//     guesthouse: "guesthouse",
//     "guest-house": "guesthouse",
//     hostel: "hostel",
//     camp: "camp",
//     campsite: "campsite",
//     farmhouse: "farmhouse",
//     "vacation-home": "vacation-home",
//     "vacation-house": "vacation-home",
//     palace: "palace",
//     motel: "motel",
//     bnb: "bnb",
//     lodge: "lodge",
//     inn: "inn",
//     "serviced-apartment": "serviced-apartment",

//     cab: "cab",
//     taxi: "cab",
//     "car-rental": "car-rental",
//     "bike-rental": "bike-rental",

//     bus: "bus",

//     package: "packages",
//     packages: "packages",
//     holiday: "holiday-package",
//     holidays: "holiday-package",
//     tour: "holiday-package",
//     tours: "holiday-package",

//     activity: "activities",
//     activities: "activities",
//     experience: "activities",
//     experiences: "activities",

//     event: "events",
//     events: "events",
//     nightlife: "night-club",
//     nightclub: "night-club",
//     "night-club": "night-club",

//     darshan: "darshan",
//     "bmt-darshan": "darshan",
//     religious: "darshan",

//     cruise: "cruise",
//     cruises: "cruise",

//     visa: "visa",
//     insurance: "travel-insurance",
//     "travel-insurance": "travel-insurance",

//     other: "other",
//   };

//   const normalized = aliases[raw] || raw;

//   return LEGACY_SERVICES.has(normalized) ? normalized : "";
// };

// /* ==========================================================
//    NORMALIZE SERVICES
// ========================================================== */

// const VERTICAL_SERVICE_MAP = {
//   bus: "bus",
//   cab: "cab",
//   packages: "packages",
//   activities: "activities",
//   events: "events",
//   darshan: "darshan",
//   cruise: "cruise",
// };

// const normalizeServices = ({ services, vertical, staySubtype }) => {
//   let list = [];

//   if (Array.isArray(services)) {
//     list = services;
//   } else if (services) {
//     list = [services];
//   }

//   list = list.map(normalizeLegacyService).filter(Boolean);

//   // Never save parent stay in legacy services.
//   list = list.filter((item) => item !== "stay");

//   // Stay => subtype service.
//   if (vertical === "stay" && staySubtype) {
//     const subtypeService = normalizeLegacyService(staySubtype);

//     if (subtypeService && !list.includes(subtypeService)) {
//       list.push(subtypeService);
//     }
//   }

//   // Other BMT verticals.
//   if (vertical && vertical !== "stay") {
//     const mapped = VERTICAL_SERVICE_MAP[vertical];

//     if (mapped && !list.includes(mapped)) {
//       list.push(mapped);
//     }
//   }

//   return [...new Set(list)];
// };

// /* ==========================================================
//    CREATE JWT

//    IMPORTANT: called ONLY AFTER admin approval.
// ========================================================== */

// const createToken = (vendor) => {
//   const secret = process.env.JWT_SECRET;

//   if (!secret) {
//     throw new Error("JWT_SECRET is not configured");
//   }

//   return jwt.sign(
//     {
//       id: vendor._id,
//       vendorId: vendor._id,
//       role: vendor.role,
//       isOwnerAccount: vendor.isOwnerAccount,
//       vertical: vendor.vertical,
//       selectedVertical: vendor.selectedVertical,
//       staySubtype: vendor.staySubtype,
//     },
//     secret,
//     {
//       expiresIn: process.env.JWT_EXPIRES_IN || "7d",
//     }
//   );
// };

// /* ==========================================================
//    SAFE VENDOR RESPONSE
// ========================================================== */

// const safeVendorResponse = (vendor) => {
//   if (!vendor) {
//     return null;
//   }

//   const source =
//     typeof vendor.toObject === "function" ? vendor.toObject() : vendor;

//   return {
//     _id: source._id,
//     id: source._id,
//     name: source.name,
//     email: source.email,
//     phone: source.phone,
//     role: source.role,
//     isOwnerAccount: source.isOwnerAccount,

//     vertical: source.vertical,
//     selectedVertical: source.selectedVertical,
//     staySubtype: source.staySubtype,
//     service: source.service,
//     services: source.services || [],

//     businessName: source.businessName,
//     legalBusinessName: source.legalBusinessName,
//     businessType: source.businessType,
//     businessEmail: source.businessEmail,
//     businessPhone: source.businessPhone,

//     country: source.country,
//     countryCode: source.countryCode,
//     state: source.state,
//     city: source.city,
//     postalCode: source.postalCode,
//     address: source.address,
//     timezone: source.timezone,

//     preferredLanguage: source.preferredLanguage,
//     preferredCurrency: source.preferredCurrency,
//     settlementCurrency: source.settlementCurrency,

//     onboardingStatus: source.onboardingStatus,
//     onboardingComplete: source.onboardingComplete,
//     onboardingStep: source.onboardingStep,
//     onboardingProgress: source.onboardingProgress,

//     status: source.status,
//     isApproved: source.isApproved,
//     isActive: source.isActive,
//     accountStatus: source.accountStatus,

//     createdAt: source.createdAt,
//     updatedAt: source.updatedAt,
//   };
// };

// /* ==========================================================
//    DASHBOARD RESOLVER

//    MongoDB is source of truth. Frontend localStorage /
//    dropdown does NOT decide which dashboard opens.
// ========================================================== */

// const DASHBOARD_MAP = {
//   bus: "/vendor/bus",
//   cab: "/vendor/cab",
//   packages: "/vendor/packages",
//   activities: "/vendor/activities",
//   events: "/vendor/events",
//   darshan: "/vendor/darshan",
//   cruise: "/vendor/cruise",
// };

// const resolveDashboard = (vendor) => {
//   const vertical = normalizeVertical(
//     vendor?.selectedVertical || vendor?.vertical
//   );

//   if (!vertical) {
//     return "/onboarding";
//   }

//   // Stay dashboard is subtype-specific.
//   if (vertical === "stay") {
//     const subtype = normalizeStaySubtype(vendor?.staySubtype);

//     if (!subtype) {
//       return "/onboarding";
//     }

//     return `/vendor/stay/${subtype}`;
//   }

//   return DASHBOARD_MAP[vertical] || "/onboarding";
// };

// /* ==========================================================
//    DUPLICATE (409) HELPERS

//    Pehle: koi bhi match => seedha 409 (even for the SAME
//    person re-submitting onboarding).

//    Ab:
//    - approved / suspended account      => 409 "please login"
//    - pending / rejected + same email
//      + SAME password                   => application UPDATE (no 409)
//    - password alag ya phone kisi aur ka => 409 with exact field
// ========================================================== */

// const labelFor = (emailTaken, phoneTaken) => {
//   if (emailTaken && phoneTaken) return "email and phone number";
//   if (emailTaken) return "email";
//   return "phone number";
// };

// /* Mongo E11000 => readable field + code */
// const describeDuplicateKey = (error) => {
//   const source = error?.keyPattern || error?.keyValue || {};
//   const field = Object.keys(source)[0] || "field";

//   if (field === "email") {
//     return {
//       code: "EMAIL_ALREADY_EXISTS",
//       field,
//       message: "A vendor account already exists with this email. Please login.",
//     };
//   }

//   if (field === "phone") {
//     return {
//       code: "PHONE_ALREADY_EXISTS",
//       field,
//       message:
//         "A vendor account already exists with this phone number. Please login.",
//     };
//   }

//   return {
//     code: "DUPLICATE_VENDOR",
//     field,
//     message: `Duplicate value for "${field}". If you did not enter the same value anywhere else, ask the admin to run scripts/fixVendorIndexes.js (stale database index).`,
//   };
// };

// /* ==========================================================
//    SIGNUP
// ========================================================== */

// exports.signup = async (req, res) => {
//   try {
//     const body = req.body || {};

//     /* ======================================================
//        AUTH DATA
//     ====================================================== */

//     const email = normalizeEmail(body.email || body.businessEmail);

//     const businessEmail = normalizeEmail(body.businessEmail || body.email);

//     const phone = normalizePhone(
//       body.phone || body.businessPhone || body.ownerPhone
//     );

//     const password = normalizeString(body.password);

//     /* ======================================================
//        VALIDATION
//     ====================================================== */

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         code: "EMAIL_REQUIRED",
//         message: "Email is required",
//       });
//     }

//     if (!phone) {
//       return res.status(400).json({
//         success: false,
//         code: "PHONE_REQUIRED",
//         message: "Phone number is required",
//       });
//     }

//     if (!password) {
//       return res.status(400).json({
//         success: false,
//         code: "PASSWORD_REQUIRED",
//         message: "Password is required",
//       });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({
//         success: false,
//         code: "PASSWORD_TOO_SHORT",
//         message: "Password must be at least 6 characters",
//       });
//     }

//     /* ======================================================
//        DUPLICATE VENDOR CHECK (smart)
//     ====================================================== */

//     const matches = await Vendor.find({
//       $or: [
//         { email },
//         { businessEmail: email },
//         { phone },
//         { businessPhone: phone },
//       ],
//     }).select("+password");

//     let existingApplication = null;

//     // Email ek vendor ka, phone doosre vendor ka
//     if (matches.length > 1) {
//       return res.status(409).json({
//         success: false,
//         code: "CONTACT_DETAILS_CONFLICT",
//         message:
//           "This email and phone number belong to different vendor accounts. Please use your own details or login.",
//       });
//     }

//     if (matches.length === 1) {
//       const existing = matches[0];

//       const emailTaken =
//         existing.email === email || existing.businessEmail === email;

//       const phoneTaken =
//         existing.phone === phone || existing.businessPhone === phone;

//       const currentStatus = String(existing.status || "PENDING").toUpperCase();

//       const label = labelFor(emailTaken, phoneTaken);

//       // Approved / suspended account => login karna hoga
//       if (
//         currentStatus === "APPROVED" ||
//         currentStatus === "SUSPENDED" ||
//         existing.isApproved === true
//       ) {
//         return res.status(409).json({
//           success: false,
//           code: "VENDOR_ALREADY_EXISTS",
//           conflictField: emailTaken ? "email" : "phone",
//           status: existing.status || "PENDING",
//           isApproved: existing.isApproved === true,
//           message: `A vendor account already exists with this ${label}. Please login.`,
//         });
//       }

//       // Sirf phone match hua (email alag) => kisi aur ka number hai
//       if (!emailTaken) {
//         return res.status(409).json({
//           success: false,
//           code: "PHONE_ALREADY_EXISTS",
//           conflictField: "phone",
//           status: existing.status || "PENDING",
//           isApproved: false,
//           message:
//             "This phone number is already used in another vendor application.",
//         });
//       }

//       // Pending / rejected application: same password => resubmit allowed
//       const passwordOk = existing.password
//         ? await bcrypt.compare(password, existing.password)
//         : false;

//       if (!passwordOk) {
//         return res.status(409).json({
//           success: false,
//           code: "EMAIL_ALREADY_EXISTS",
//           conflictField: "email",
//           status: existing.status || "PENDING",
//           isApproved: false,
//           message:
//             "An application with this email already exists. Use the same password you registered with to update it, or login.",
//         });
//       }

//       existingApplication = existing;
//     }

//     /* ======================================================
//        SELECTED VERTICAL
//     ====================================================== */

//     const selectedVertical = normalizeVertical(
//       body.selectedVertical || body.vertical || body.service
//     );

//     if (!selectedVertical || !MAIN_VERTICALS.includes(selectedVertical)) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_VERTICAL",
//         message: "Please select a valid business vertical.",
//       });
//     }

//     /* ======================================================
//        STAY SUBTYPE
//     ====================================================== */

//     let staySubtype = "";

//     if (selectedVertical === "stay") {
//       staySubtype = normalizeStaySubtype(
//         body.staySubtype ||
//           body.subtype ||
//           body.propertyType ||
//           body.stayDetails?.propertyType
//       );

//       // Frontend may send: service = hotel
//       if (!staySubtype && body.service) {
//         staySubtype = normalizeStaySubtype(body.service);
//       }

//       // Frontend may send: services = ["stay", "hotel"]
//       if (!staySubtype && Array.isArray(body.services)) {
//         const foundSubtype = body.services.find((item) =>
//           normalizeStaySubtype(item)
//         );

//         if (foundSubtype) {
//           staySubtype = normalizeStaySubtype(foundSubtype);
//         }
//       }

//       // Stay must always have subtype.
//       if (!staySubtype) {
//         return res.status(400).json({
//           success: false,
//           code: "STAY_SUBTYPE_REQUIRED",
//           message: "Please select your stay/property type.",
//         });
//       }
//     }

//     /* ======================================================
//        SERVICES
//     ====================================================== */

//     const services = normalizeServices({
//       services: body.services || body.service,
//       vertical: selectedVertical,
//       staySubtype,
//     });

//     /* ======================================================
//        BUSINESS TYPE
//     ====================================================== */

//     const businessType = normalizeBusinessType(body.businessType);

//     if (body.businessType && !businessType) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_BUSINESS_TYPE",
//         message: `Unsupported business type: ${body.businessType}`,
//       });
//     }

//     /* ======================================================
//        VERTICAL DETAILS
//        cruise / packages / activities / events / darshan
//        (sanitized + required-field validation)
//     ====================================================== */

//     const { details: verticalDetails, error: verticalError } =
//       prepareVerticalDetails(body, selectedVertical);

//     if (verticalError) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_VERTICAL_DETAILS",
//         message: verticalError,
//       });
//     }

//     /* ======================================================
//        PASSWORD HASH
//     ====================================================== */

//     const salt = await bcrypt.genSalt(10);

//     const hashedPassword = await bcrypt.hash(password, salt);

//     /* ======================================================
//        STAY DETAILS
//     ====================================================== */

//     const stayDetails = sanitizeDetails({
//       ...(body.stayDetails || {}),
//     });

//     if (selectedVertical === "stay" && staySubtype) {
//       stayDetails.propertyType = staySubtype;
//     }

//     /* ======================================================
//        VENDOR DATA
//     ====================================================== */

//     const vendorData = {
//       /* ---------- ACCOUNT ---------- */
//       name: normalizeString(
//         body.name || body.ownerName || body.contactName || body.businessName
//       ),

//       email,
//       phone,
//       password: hashedPassword,
//       role: "owner",
//       isOwnerAccount: true,

//       /* ---------- VERTICAL ---------- */
//       vertical: selectedVertical,
//       selectedVertical,
//       staySubtype,

//       /* ---------- LEGACY SERVICE ---------- */
//       services,

//       service:
//         selectedVertical === "stay"
//           ? staySubtype
//           : normalizeLegacyService(body.service) ||
//             normalizeLegacyService(selectedVertical),

//       /* ---------- BUSINESS ---------- */
//       businessName: normalizeString(body.businessName),
//       legalBusinessName: normalizeString(body.legalBusinessName),
//       businessType,
//       businessEmail,
//       businessPhone: normalizePhone(body.businessPhone || phone),
//       website: normalizeString(body.website),
//       businessRegistrationNumber: normalizeString(
//         body.businessRegistrationNumber
//       ),
//       taxRegistrationNumber: normalizeString(body.taxRegistrationNumber),
//       vatNumber: normalizeString(body.vatNumber),
//       gstNumber: normalizeString(body.gstNumber),
//       businessLicenseNumber: normalizeString(body.businessLicenseNumber),

//       /* ---------- LOCATION ---------- */
//       country: normalizeString(body.country),
//       countryCode: normalizeString(body.countryCode),
//       state: normalizeString(body.state || body.stateProvince || body.region),
//       city: normalizeString(body.city),
//       district: normalizeString(body.district),
//       locality: normalizeString(body.locality),
//       landmark: normalizeString(body.landmark),
//       addressLine1: normalizeString(body.addressLine1),
//       addressLine2: normalizeString(body.addressLine2),
//       postalCode: normalizeString(body.postalCode || body.pincode),
//       pincode: normalizeString(body.pincode || body.postalCode),
//       address: normalizeString(body.address),
//       timezone: normalizeString(body.timezone),

//       /* ---------- PREFERENCES ---------- */
//       preferredLanguage: normalizeString(body.preferredLanguage),
//       preferredCurrency: normalizeString(body.preferredCurrency),
//       settlementCurrency: normalizeString(body.settlementCurrency),

//       /* ---------- OWNER ---------- */
//       ownerName: normalizeString(body.ownerName || body.name),
//       ownerEmail: normalizeEmail(body.ownerEmail || email),
//       ownerPhone: normalizePhone(body.ownerPhone || phone),

//       /* ---------- STAY ---------- */
//       stayDetails,

//       /* ---------- CRUISE / TOURS / ACTIVITIES / EVENTS / DARSHAN ---------- */
//       ...verticalDetails,

//       /* ---------- ONBOARDING ---------- */
//       onboardingStatus: "submitted",
//       onboardingComplete: true,
//       onboardingStep: 18,
//       onboardingProgress: 100,
//       onboardingSubmittedAt: new Date(),

//       /* ==================================================
//          ADMIN APPROVAL

//          MOST IMPORTANT: Signup DOES NOT approve vendor.
//       ================================================== */
//       status: "PENDING",
//       isApproved: false,
//       isActive: true,
//       accountStatus: "active",
//     };

//     /* ======================================================
//        OPTIONAL ONBOARDING FIELDS
//     ====================================================== */

//     const optionalFields = [
//       "businessDescription",
//       "communicationNumber",
//       "whatsappNumber",
//       "ownerDesignation",
//       "ownerGovernmentIdType",
//       "ownerGovernmentIdNumber",
//       "governmentIdType",
//       "governmentIdNumber",
//       "bankCountry",
//       "bankCurrency",
//       "bankName",
//       "branchName",
//       "bankAccountName",
//       "bankAccountNumber",
//       "bankSwiftCode",
//       "bankIban",
//       "bankIfscCode",
//       "iban",
//       "swiftCode",
//       "routingNumber",
//       "taxCountry",
//       "taxType",
//       "taxName",
//       "taxId",
//       "logo",
//       "businessLogo",
//       "documents",
//       "media",
//       "contractAccepted",
//       "termsAccepted",
//       "privacyAccepted",
//       "cabDetails",
//       "carRentalDetails",
//       "busDetails",
//       "panNumber",
//       "panCardNumber",
//       "panCard",
//       "aadharNumber",
//       "aadharFront",
//       "aadharBack",
//       "gstRegistrationNumber",
//       "gstCertificate",
//       "accountHolderName",
//       "accountNumber",
//       "ifscCode",
//       "upiId",
//       "cancelledCheque",
//       "passbookImage",
//       "applicationMeta",
//     ];

//     optionalFields.forEach((field) => {
//       if (body[field] !== undefined) {
//         vendorData[field] = sanitizeDetails(body[field]);
//       }
//     });

//     // Never store the confirmation copy of the account number.
//     delete vendorData.confirmAccountNumber;

//     /* ======================================================
//        CREATE  (or UPDATE the same pending application)
//     ====================================================== */

//     let vendor;
//     let resubmitted = false;

//     if (existingApplication) {
//       existingApplication.set({
//         ...vendorData,
//         rejectionReason: "",
//         onboardingRejectionReason: "",
//         onboardingRejectedAt: null,
//       });

//       vendor = await existingApplication.save();
//       resubmitted = true;
//     } else {
//       vendor = await Vendor.create(vendorData);
//     }

//     /* ======================================================
//        IMPORTANT: NO TOKEN, NO AUTO LOGIN, NO DASHBOARD ACCESS.
//        Admin approval required.
//     ====================================================== */

//     return res.status(resubmitted ? 200 : 201).json({
//       success: true,
//       code: resubmitted ? "APPLICATION_UPDATED" : "APPLICATION_SUBMITTED",
//       message: resubmitted
//         ? "Your existing application was updated and is waiting for admin approval."
//         : "Registration submitted successfully. Your BMT Connect vendor application is waiting for admin approval.",
//       resubmitted,
//       approvalRequired: true,
//       status: "PENDING",
//       isApproved: false,
//       vendor: safeVendorResponse(vendor),
//     });
//   } catch (error) {
//     console.error("❌ Vendor Signup Error:", error);

//     /* ---------- DUPLICATE MONGODB ERROR ---------- */
//     if (error?.code === 11000) {
//       const info = describeDuplicateKey(error);

//       console.error(
//         "⚠️ Duplicate key:",
//         JSON.stringify(error.keyPattern || {}),
//         JSON.stringify(error.keyValue || {})
//       );

//       return res.status(409).json({
//         success: false,
//         code: info.code,
//         conflictField: info.field,
//         message: info.message,
//       });
//     }

//     /* ---------- MONGOOSE VALIDATION ERROR ---------- */
//     if (error?.name === "ValidationError") {
//       const details = Object.values(error.errors || {}).map((item) => ({
//         field: item.path,
//         value: item.value,
//         message: item.message,
//       }));

//       return res.status(400).json({
//         success: false,
//         code: "VALIDATION_ERROR",
//         message:
//           details.map((item) => item.message).join(", ") ||
//           "Invalid registration data",
//         details,
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       code: "SIGNUP_FAILED",
//       message: error?.message || "Vendor signup failed",
//     });
//   }
// };

// /* ==========================================================
//    LOGIN

//    CRITICAL SECURITY FLOW:

//    Correct password alone is NOT enough.

//    Vendor MUST also be:
//    status = APPROVED
//    isApproved = true

//    Only then JWT is issued.
// ========================================================== */

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body || {};

//     const normalizedEmail = normalizeEmail(email);

//     /* ---------- REQUIRED FIELDS ---------- */
//     if (!normalizedEmail || !password) {
//       return res.status(400).json({
//         success: false,
//         code: "EMAIL_PASSWORD_REQUIRED",
//         message: "Email and password are required",
//       });
//     }

//     /* ---------- FIND VENDOR ---------- */
//     const vendor = await Vendor.findOne({
//       $or: [{ email: normalizedEmail }, { businessEmail: normalizedEmail }],
//     }).select("+password");

//     if (!vendor) {
//       return res.status(401).json({
//         success: false,
//         code: "INVALID_CREDENTIALS",
//         message: "Invalid email or password",
//       });
//     }

//     /* ---------- VERIFY PASSWORD ---------- */
//     const passwordMatch = await bcrypt.compare(
//       String(password),
//       vendor.password
//     );

//     if (!passwordMatch) {
//       return res.status(401).json({
//         success: false,
//         code: "INVALID_CREDENTIALS",
//         message: "Invalid email or password",
//       });
//     }

//     /* ---------- SUSPENDED ACCOUNT ---------- */
//     if (
//       String(vendor.accountStatus || "").toLowerCase() === "suspended" ||
//       String(vendor.status || "").toUpperCase() === "SUSPENDED"
//     ) {
//       return res.status(403).json({
//         success: false,
//         code: "ACCOUNT_SUSPENDED",
//         status: "SUSPENDED",
//         message:
//           "Your BMT Connect vendor account has been suspended. Please contact support.",
//       });
//     }

//     /* ---------- INACTIVE ACCOUNT ---------- */
//     if (vendor.isActive === false) {
//       return res.status(403).json({
//         success: false,
//         code: "ACCOUNT_INACTIVE",
//         message: "Your BMT Connect vendor account is inactive.",
//       });
//     }

//     /* ---------- REJECTED APPLICATION ---------- */
//     if (
//       String(vendor.status || "").toUpperCase() === "REJECTED" ||
//       String(vendor.onboardingStatus || "").toLowerCase() === "rejected"
//     ) {
//       return res.status(403).json({
//         success: false,
//         code: "APPLICATION_REJECTED",
//         status: "REJECTED",
//         isApproved: false,
//         message:
//           "Your BMT Connect vendor application was rejected. Please contact support.",
//       });
//     }

//     /* ======================================================
//        ADMIN APPROVAL CHECK  (THE MAIN GATE)

//        PENDING vendor cannot login. No JWT is generated.
//     ====================================================== */

//     const approved =
//       String(vendor.status || "").toUpperCase() === "APPROVED" &&
//       vendor.isApproved === true;

//     if (!approved) {
//       return res.status(403).json({
//         success: false,
//         code: "ADMIN_APPROVAL_REQUIRED",
//         approvalRequired: true,
//         status: vendor.status || "PENDING",
//         isApproved: false,
//         message:
//           "Your vendor application is waiting for admin approval. You can sign in after BMT Connect approves your application.",
//       });
//     }

//     /* ---------- VERTICAL FROM DATABASE (never trust frontend) ---------- */
//     const selectedVertical = normalizeVertical(
//       vendor.selectedVertical || vendor.vertical
//     );

//     if (!selectedVertical || !MAIN_VERTICALS.includes(selectedVertical)) {
//       return res.status(403).json({
//         success: false,
//         code: "VERTICAL_NOT_CONFIGURED",
//         message:
//           "Your vendor account does not have a valid business vertical.",
//       });
//     }

//     /* ---------- STAY SUBTYPE ---------- */
//     let staySubtype = "";

//     if (selectedVertical === "stay") {
//       staySubtype = normalizeStaySubtype(vendor.staySubtype);

//       if (!staySubtype) {
//         return res.status(403).json({
//           success: false,
//           code: "STAY_SUBTYPE_NOT_CONFIGURED",
//           message: "Your stay/property subtype is not configured.",
//         });
//       }
//     }

//     /* ---------- EXACT DASHBOARD (database decides) ---------- */
//     const dashboard = resolveDashboard(vendor);

//     if (!dashboard || dashboard === "/onboarding") {
//       return res.status(403).json({
//         success: false,
//         code: "DASHBOARD_NOT_CONFIGURED",
//         message: "Dashboard could not be resolved for this vendor account.",
//       });
//     }

//     /* ---------- JWT (only after approval) ---------- */
//     const token = createToken(vendor);

//     return res.status(200).json({
//       success: true,
//       code: "LOGIN_SUCCESS",
//       message: "Login successful",
//       token,
//       dashboard,
//       vertical: selectedVertical,
//       staySubtype: selectedVertical === "stay" ? staySubtype : "",
//       vendor: safeVendorResponse(vendor),
//     });
//   } catch (error) {
//     console.error("❌ Vendor Login Error:", error);

//     return res.status(500).json({
//       success: false,
//       code: "LOGIN_FAILED",
//       message: error?.message || "Vendor login failed",
//     });
//   }
// };

// /* ==========================================================
//    GET LOGGED-IN VENDOR PROFILE

//    Vendor dashboards (packages / activities / events /
//    darshan / cruise) read their onboarding data from
//    `vendor.verticalDetails`.
// ========================================================== */

// exports.getVendorProfile = async (req, res) => {
//   try {
//     const vendorId =
//       req.vendor?._id ||
//       req.vendor?.id ||
//       req.user?._id ||
//       req.user?.id ||
//       req.vendorId;

//     if (!vendorId) {
//       return res.status(401).json({
//         success: false,
//         code: "UNAUTHORIZED",
//         message: "Unauthorized",
//       });
//     }

//     const vendor = await Vendor.findById(vendorId).select("-password");

//     if (!vendor) {
//       return res.status(404).json({
//         success: false,
//         code: "VENDOR_NOT_FOUND",
//         message: "Vendor not found",
//       });
//     }

//     /*
//      * Extra protection: even with an old/stale token,
//      * pending/suspended vendor shouldn't receive the profile.
//      */
//     if (
//       String(vendor.status || "").toUpperCase() !== "APPROVED" ||
//       vendor.isApproved !== true
//     ) {
//       return res.status(403).json({
//         success: false,
//         code: "ADMIN_APPROVAL_REQUIRED",
//         message: "Vendor account is not approved.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Vendor profile fetched successfully",
//       vendor: {
//         ...safeVendorResponse(vendor),
//         verticalDetails: pickVerticalDetails(vendor),
//       },
//       dashboard: resolveDashboard(vendor),
//     });
//   } catch (error) {
//     console.error("❌ Vendor Profile Error:", error);

//     return res.status(500).json({
//       success: false,
//       code: "PROFILE_FAILED",
//       message: error?.message || "Unable to load vendor profile",
//     });
//   }
// };

// /* ==========================================================
//    GET ALL VENDORS
// ========================================================== */

// exports.getAllVendors = async (req, res) => {
//   try {
//     const vendors = await Vendor.find({})
//       .select("-password")
//       .sort({ createdAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: vendors.length,
//       vendors: vendors.map(safeVendorResponse),
//     });
//   } catch (error) {
//     console.error("❌ Get Vendors Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error?.message || "Unable to load vendors",
//     });
//   }
// };

// /* ==========================================================
//    GET PENDING VENDORS  (ADMIN PANEL)
// ========================================================== */

// exports.getPendingVendors = async (req, res) => {
//   try {
//     const vendors = await Vendor.find({
//       $or: [
//         { status: "PENDING" },
//         { onboardingStatus: "submitted" },
//         { onboardingStatus: "under_review" },
//       ],
//     })
//       .select("-password")
//       .sort({ createdAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: vendors.length,
//       vendors: vendors.map(safeVendorResponse),
//     });
//   } catch (error) {
//     console.error("❌ Pending Vendors Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error?.message || "Unable to load pending vendors",
//     });
//   }
// };

// /* ==========================================================
//    GET ONE VENDOR WITH FULL APPLICATION  (ADMIN PANEL)

//    Admin needs the complete onboarding data (details,
//    documents, bank, tax) to approve / reject properly.
// ========================================================== */

// exports.getVendorApplication = async (req, res) => {
//   try {
//     const vendor = await Vendor.findById(req.params.id).select("-password");

//     if (!vendor) {
//       return res.status(404).json({
//         success: false,
//         code: "VENDOR_NOT_FOUND",
//         message: "Vendor not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       vendor,
//     });
//   } catch (error) {
//     console.error("❌ Vendor Application Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error?.message || "Unable to load vendor application",
//     });
//   }
// };

// /* ==========================================================
//    APPROVE VENDOR  (ADMIN PANEL ACTION)

//    After this: vendor CAN login.
// ========================================================== */

// exports.approveVendor = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const vendor = await Vendor.findById(id);

//     if (!vendor) {
//       return res.status(404).json({
//         success: false,
//         code: "VENDOR_NOT_FOUND",
//         message: "Vendor not found",
//       });
//     }

//     // Do not approve suspended vendor accidentally.
//     if (String(vendor.status || "").toUpperCase() === "SUSPENDED") {
//       return res.status(409).json({
//         success: false,
//         code: "VENDOR_SUSPENDED",
//         message: "Suspended vendor cannot be approved directly.",
//       });
//     }

//     vendor.status = "APPROVED";
//     vendor.isApproved = true;
//     vendor.isActive = true;
//     vendor.accountStatus = "active";
//     vendor.onboardingStatus = "approved";
//     vendor.onboardingComplete = true;
//     vendor.onboardingProgress = 100;
//     vendor.approvedAt = new Date();
//     vendor.onboardingApprovedAt = new Date();

//     await vendor.save();

//     return res.status(200).json({
//       success: true,
//       code: "VENDOR_APPROVED",
//       message: "Vendor approved successfully. Vendor can now sign in.",
//       vendor: safeVendorResponse(vendor),
//       dashboard: resolveDashboard(vendor),
//     });
//   } catch (error) {
//     console.error("❌ Approve Vendor Error:", error);

//     return res.status(500).json({
//       success: false,
//       code: "APPROVE_VENDOR_FAILED",
//       message: error?.message || "Unable to approve vendor",
//     });
//   }
// };

// /* ==========================================================
//    REJECT VENDOR  (ADMIN PANEL ACTION)

//    Rejected vendor cannot login.
// ========================================================== */

// exports.rejectVendor = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const vendor = await Vendor.findById(id);

//     if (!vendor) {
//       return res.status(404).json({
//         success: false,
//         code: "VENDOR_NOT_FOUND",
//         message: "Vendor not found",
//       });
//     }

//     vendor.status = "REJECTED";
//     vendor.isApproved = false;
//     vendor.onboardingStatus = "rejected";
//     vendor.onboardingRejectedAt = new Date();

//     if (req.body?.reason !== undefined) {
//       const reason = normalizeString(req.body.reason);

//       vendor.rejectionReason = reason;
//       vendor.onboardingRejectionReason = reason;
//     }

//     await vendor.save();

//     return res.status(200).json({
//       success: true,
//       code: "VENDOR_REJECTED",
//       message: "Vendor rejected successfully",
//       vendor: safeVendorResponse(vendor),
//     });
//   } catch (error) {
//     console.error("❌ Reject Vendor Error:", error);

//     return res.status(500).json({
//       success: false,
//       code: "REJECT_VENDOR_FAILED",
//       message: error?.message || "Unable to reject vendor",
//     });
//   }
// };

const Vendor = require("../models/Vendor.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const MAIN_VERTICALS = [
  "stay",
  "bus",
  "cab",
  "packages",
  "activities",
  "events",
  "darshan",
  "cruise",
];

const STAY_SUBTYPES = [
  "hotel",
  "homestay",
  "resort",
  "villa",
  "apartment",
  "guesthouse",
  "hostel",
  "camp",
  "campsite",
  "farmhouse",
  "vacation-home",
  "palace",
  "motel",
  "bnb",
  "lodge",
  "inn",
  "serviced-apartment",
];

/* ==========================================================
   BASIC HELPERS
========================================================== */

const normalizeString = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const normalizeEmail = (value) => normalizeString(value).toLowerCase();

const normalizePhone = (value) =>
  normalizeString(value).replace(/[^\d+]/g, "");

const normalizeSlug = (value) =>
  normalizeString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, " ")
    .replace(/_/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* ==========================================================
   VERTICAL DETAILS
   (Cruise / Tours / Activities / Events / Darshan)

   Frontend sends one details object per vertical:
     cruise     -> cruiseDetails
     packages   -> packageDetails
     activities -> activityDetails
     events     -> eventDetails
     darshan    -> darshanDetails

   Stay / Bus / Cab keep their existing flows.
========================================================== */

const DETAILS_KEY = {
  cruise: "cruiseDetails",
  packages: "packageDetails",
  activities: "activityDetails",
  events: "eventDetails",
  darshan: "darshanDetails",
};

/*
  [path, label, mustBePositive]
  Path uses dot notation: "policies.cancellation"
*/
const REQUIRED_RULES = {
  cruise: [
    ["cruiseOperatorName", "Cruise operator name"],
    ["cruiseLineName", "Cruise line name"],
    ["cruiseType", "Cruise type"],
    ["cruiseOperatorType", "Operator type"],
    ["vesselType", "Vessel type"],
    ["cruiseCategory", "Service category"],
    ["shipName", "Ship name"],
    ["passengerCapacity", "Passenger capacity", true],
    ["numberOfCabins", "Total cabins", true],
    ["cabinTypes", "Cabin types"],
    ["departurePort", "Departure port"],
    ["destinationPort", "Destination"],
    ["cruiseDuration", "Cruise duration"],
    ["amenities", "Cruise amenities"],
    ["policies.cancellation", "Cancellation policy"],
    ["policies.refund", "Refund policy"],
    ["policies.child", "Child policy"],
    ["policies.baggage", "Baggage policy"],
    ["policies.passportVisa", "Passport / visa requirements"],
    ["policies.checkIn", "Check-in / boarding policy"],
  ],

  packages: [
    ["classification.operatingRegion", "Operating region"],
    ["classification.packageCategories", "Package categories"],
    ["classification.destinationsCovered", "Destinations covered"],
    ["inventory.activePackages", "Number of active packages"],
    ["amenities.services", "Services offered"],
    ["policies.cancellationPolicy", "Cancellation policy"],
    ["policies.refundPolicy", "Refund policy"],
    ["media.propertyImages", "Tour images"],
  ],

  activities: [
    ["classification.activityCategories", "Activity categories"],
    ["classification.difficultyLevel", "Difficulty level"],
    ["inventory.totalActivities", "Number of activities"],
    ["inventory.maxParticipantsPerSlot", "Max participants per slot"],
    ["amenities.facilities", "Facilities"],
    ["policies.cancellationPolicy", "Cancellation policy"],
    ["policies.refundPolicy", "Refund policy"],
    ["policies.safetyRules", "Safety rules"],
    ["media.propertyImages", "Activity images"],
  ],

  events: [
    ["classification.eventCategories", "Event categories"],
    ["classification.venueType", "Venue type"],
    ["classification.ageRestriction", "Age restriction"],
    ["inventory.venueCapacity", "Maximum capacity"],
    ["amenities.facilities", "Facilities"],
    ["policies.cancellationPolicy", "Cancellation policy"],
    ["policies.refundPolicy", "Refund policy"],
    ["policies.entryPolicy", "Entry policy"],
    ["media.propertyImages", "Event images"],
  ],

  darshan: [
    ["basic.mainDeity", "Main deity / place of worship"],
    ["basic.tradition", "Tradition"],
    ["classification.placeType", "Type of place"],
    ["classification.serviceCategories", "Services offered"],
    ["inventory.openingTime", "Opening time"],
    ["inventory.closingTime", "Closing time"],
    ["inventory.dailyCapacity", "Daily darshan capacity"],
    ["amenities.facilities", "Facilities"],
    ["policies.cancellationPolicy", "Cancellation policy"],
    ["policies.refundPolicy", "Refund policy"],
    ["policies.dressCode", "Dress code"],
    ["media.propertyImages", "Images"],
  ],
};

/* Removes "$where", "a.b", "__proto__" style keys (NoSQL injection guard). */
const sanitizeDetails = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeDetails);
  }

  if (value && typeof value === "object") {
    const clean = {};

    Object.entries(value).forEach(([key, val]) => {
      if (
        key.startsWith("$") ||
        key.includes(".") ||
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype"
      ) {
        return;
      }

      clean[key] = sanitizeDetails(val);
    });

    return clean;
  }

  return value;
};

const getPath = (obj, path) =>
  path
    .split(".")
    .reduce(
      (acc, key) => (acc === undefined || acc === null ? undefined : acc[key]),
      obj
    );

const isBlank = (value) => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
};

/*
  returns
    { details: { cruiseDetails: {...} }, error: "" }
    { details: {}, error: "Cruise line name is required." }
*/
const prepareVerticalDetails = (body, vertical) => {
  const key = DETAILS_KEY[vertical];

  // stay / bus / cab: not handled here
  if (!key) {
    return { details: {}, error: "" };
  }

  const raw = body?.[key];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      details: {},
      error: `${key} is required for the ${vertical} vertical.`,
    };
  }

  const details = sanitizeDetails(raw);

  for (const [path, label, positive] of REQUIRED_RULES[vertical] || []) {
    const value = getPath(details, path);

    if (isBlank(value)) {
      return { details: {}, error: `${label} is required.` };
    }

    if (positive && !(Number(value) > 0)) {
      return { details: {}, error: `${label} must be greater than 0.` };
    }
  }

  return { details: { [key]: details }, error: "" };
};

/* Whatever vertical details exist on a vendor document. */
const pickVerticalDetails = (vendor) => {
  const source =
    typeof vendor.toObject === "function" ? vendor.toObject() : vendor;

  const out = {};

  Object.values(DETAILS_KEY).forEach((key) => {
    if (source[key]) {
      out[key] = source[key];
    }
  });

  return out;
};

/* ==========================================================
   BUSINESS TYPE NORMALIZER
========================================================== */

const normalizeBusinessType = (value) => {
  if (!value) {
    return "";
  }

  const raw = normalizeSlug(value);

  const aliases = {
    individual: "individual",
    "individual-owner": "individual-owner",
    "sole-proprietorship": "sole-proprietorship",
    proprietorship: "proprietorship",
    partnership: "partnership",
    llp: "llp",
    company: "company",
    corporation: "corporation",
    "private-company": "private-limited",
    "private-limited-company": "private-limited",
    "private-limited": "private-limited",
    "public-company": "public-limited",
    "public-limited-company": "public-limited",
    "public-limited": "public-limited",
    agency: "agency",
    "travel-agency": "agency",
    "tour-operator": "tour-operator",
    dmc: "dmc",
    "destination-management-company": "dmc",
    "property-group": "hotel-property-group",
    "hotel-group": "hotel-property-group",
    "hotel-property-group": "hotel-property-group",
    "transport-operator": "transport-operator",
    "bus-operator": "bus-operator",
    "fleet-owner": "fleet-owner",
    "activity-operator": "activity-operator",
    "event-organizer": "event-organizer",
    "cruise-operator": "cruise-operator",
    "religious-temple-trust": "religious-darshan-operator",
    "religious-darshan-operator": "religious-darshan-operator",
    "darshan-operator": "religious-darshan-operator",
    "non-profit-foundation": "non-profit",
    "non-profit": "non-profit",
    government: "government",
    "government-public-authority": "government",
    other: "other",
  };

  return aliases[raw] || "";
};

/* ==========================================================
   VERTICAL NORMALIZER
========================================================== */

const normalizeVertical = (value) => {
  const raw = normalizeSlug(value);

  const aliases = {
    stay: "stay",
    stays: "stay",
    accommodation: "stay",
    accommodations: "stay",

    hotel: "stay",
    homestay: "stay",
    resort: "stay",
    villa: "stay",
    apartment: "stay",
    guesthouse: "stay",
    hostel: "stay",
    camp: "stay",
    campsite: "stay",
    farmhouse: "stay",
    "vacation-home": "stay",
    palace: "stay",
    motel: "stay",
    bnb: "stay",
    lodge: "stay",
    inn: "stay",
    "serviced-apartment": "stay",

    bus: "bus",
    buses: "bus",

    cab: "cab",
    cabs: "cab",
    taxi: "cab",
    "car-rental": "cab",

    package: "packages",
    packages: "packages",
    holiday: "packages",
    holidays: "packages",
    tour: "packages",
    tours: "packages",

    activity: "activities",
    activities: "activities",
    experience: "activities",
    experiences: "activities",

    event: "events",
    events: "events",
    nightlife: "events",
    nightclub: "events",

    darshan: "darshan",
    religious: "darshan",
    temple: "darshan",

    cruise: "cruise",
    cruises: "cruise",
  };

  return aliases[raw] || "";
};

/* ==========================================================
   STAY SUBTYPE NORMALIZER
========================================================== */

const normalizeStaySubtype = (value) => {
  const raw = normalizeSlug(value);

  const aliases = {
    hotel: "hotel",
    homestay: "homestay",
    resort: "resort",
    villa: "villa",
    apartment: "apartment",
    "serviced-apartment": "serviced-apartment",
    guesthouse: "guesthouse",
    "guest-house": "guesthouse",
    hostel: "hostel",
    camp: "camp",
    campsite: "campsite",
    "camp-site": "campsite",
    farmhouse: "farmhouse",
    "farm-house": "farmhouse",
    "vacation-home": "vacation-home",
    "vacation-house": "vacation-home",
    palace: "palace",
    motel: "motel",
    bnb: "bnb",
    "bed-and-breakfast": "bnb",
    lodge: "lodge",
    inn: "inn",
  };

  const subtype = aliases[raw] || "";

  return STAY_SUBTYPES.includes(subtype) ? subtype : "";
};

/* ==========================================================
   LEGACY SERVICE VALUES

   IMPORTANT: Parent "stay" is NOT stored in services[].

   Example:
   vertical         = "stay"
   selectedVertical = "stay"
   staySubtype      = "hotel"
   service          = "hotel"
   services         = ["hotel"]
========================================================== */

const LEGACY_SERVICES = new Set([
  "hotel",
  "homestay",
  "resort",
  "villa",
  "apartment",
  "guesthouse",
  "hostel",
  "camp",
  "campsite",
  "farmhouse",
  "vacation-home",
  "palace",
  "motel",
  "bnb",
  "lodge",
  "inn",
  "serviced-apartment",

  "cab",
  "car-rental",
  "bike-rental",

  "bus",

  "holiday-package",
  "packages",

  "activities",

  "events",
  "night-club",

  "BMT Darshan",
  "darshan",

  "cruise",

  "visa",
  "travel-insurance",

  "other",
]);

const normalizeLegacyService = (value) => {
  if (!value) {
    return "";
  }

  const original = normalizeString(value);

  if (original === "BMT Darshan") {
    return "BMT Darshan";
  }

  const raw = normalizeSlug(original);

  // Parent Stay must never be saved in legacy services array.
  if (raw === "stay" || raw === "stays" || raw === "accommodation") {
    return "";
  }

  const aliases = {
    hotel: "hotel",
    homestay: "homestay",
    resort: "resort",
    villa: "villa",
    apartment: "apartment",
    guesthouse: "guesthouse",
    "guest-house": "guesthouse",
    hostel: "hostel",
    camp: "camp",
    campsite: "campsite",
    farmhouse: "farmhouse",
    "vacation-home": "vacation-home",
    "vacation-house": "vacation-home",
    palace: "palace",
    motel: "motel",
    bnb: "bnb",
    lodge: "lodge",
    inn: "inn",
    "serviced-apartment": "serviced-apartment",

    cab: "cab",
    taxi: "cab",
    "car-rental": "car-rental",
    "bike-rental": "bike-rental",

    bus: "bus",

    package: "packages",
    packages: "packages",
    holiday: "holiday-package",
    holidays: "holiday-package",
    tour: "holiday-package",
    tours: "holiday-package",

    activity: "activities",
    activities: "activities",
    experience: "activities",
    experiences: "activities",

    event: "events",
    events: "events",
    nightlife: "night-club",
    nightclub: "night-club",
    "night-club": "night-club",

    darshan: "darshan",
    "bmt-darshan": "darshan",
    religious: "darshan",

    cruise: "cruise",
    cruises: "cruise",

    visa: "visa",
    insurance: "travel-insurance",
    "travel-insurance": "travel-insurance",

    other: "other",
  };

  const normalized = aliases[raw] || raw;

  return LEGACY_SERVICES.has(normalized) ? normalized : "";
};

/* ==========================================================
   NORMALIZE SERVICES
========================================================== */

const VERTICAL_SERVICE_MAP = {
  bus: "bus",
  cab: "cab",
  packages: "packages",
  activities: "activities",
  events: "events",
  darshan: "darshan",
  cruise: "cruise",
};

const normalizeServices = ({ services, vertical, staySubtype }) => {
  let list = [];

  if (Array.isArray(services)) {
    list = services;
  } else if (services) {
    list = [services];
  }

  list = list.map(normalizeLegacyService).filter(Boolean);

  // Never save parent stay in legacy services.
  list = list.filter((item) => item !== "stay");

  // Stay => subtype service.
  if (vertical === "stay" && staySubtype) {
    const subtypeService = normalizeLegacyService(staySubtype);

    if (subtypeService && !list.includes(subtypeService)) {
      list.push(subtypeService);
    }
  }

  // Other BMT verticals.
  if (vertical && vertical !== "stay") {
    const mapped = VERTICAL_SERVICE_MAP[vertical];

    if (mapped && !list.includes(mapped)) {
      list.push(mapped);
    }
  }

  return [...new Set(list)];
};

/* ==========================================================
   CREATE JWT

   IMPORTANT: called ONLY AFTER admin approval.
========================================================== */

const createToken = (vendor) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: vendor._id,
      vendorId: vendor._id,
      role: vendor.role,
      isOwnerAccount: vendor.isOwnerAccount,
      vertical: vendor.vertical,
      selectedVertical: vendor.selectedVertical,
      staySubtype: vendor.staySubtype,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

/* ==========================================================
   SAFE VENDOR RESPONSE
========================================================== */

const safeVendorResponse = (vendor) => {
  if (!vendor) {
    return null;
  }

  const source =
    typeof vendor.toObject === "function" ? vendor.toObject() : vendor;

  return {
    _id: source._id,
    id: source._id,
    name: source.name,
    email: source.email,
    phone: source.phone,
    role: source.role,
    isOwnerAccount: source.isOwnerAccount,

    vertical: source.vertical,
    selectedVertical: source.selectedVertical,
    staySubtype: source.staySubtype,
    service: source.service,
    services: source.services || [],

    businessName: source.businessName,
    legalBusinessName: source.legalBusinessName,
    businessType: source.businessType,
    businessEmail: source.businessEmail,
    businessPhone: source.businessPhone,

    country: source.country,
    countryCode: source.countryCode,
    state: source.state,
    city: source.city,
    postalCode: source.postalCode,
    address: source.address,
    timezone: source.timezone,

    preferredLanguage: source.preferredLanguage,
    preferredCurrency: source.preferredCurrency,
    settlementCurrency: source.settlementCurrency,

    onboardingStatus: source.onboardingStatus,
    onboardingComplete: source.onboardingComplete,
    onboardingStep: source.onboardingStep,
    onboardingProgress: source.onboardingProgress,

    status: source.status,
    isApproved: source.isApproved,
    isActive: source.isActive,
    accountStatus: source.accountStatus,

    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

/* ==========================================================
   DASHBOARD RESOLVER

   MongoDB is source of truth. Frontend localStorage /
   dropdown does NOT decide which dashboard opens.
========================================================== */

const DASHBOARD_MAP = {
  bus: "/vendor/bus",
  cab: "/vendor/cab",
  packages: "/vendor/packages",
  activities: "/vendor/activities",
  events: "/vendor/events",
  darshan: "/vendor/darshan",
  cruise: "/vendor/cruise",
};

const resolveDashboard = (vendor) => {
  const vertical = normalizeVertical(
    vendor?.selectedVertical || vendor?.vertical
  );

  if (!vertical) {
    return "/onboarding";
  }

  // Stay dashboard is subtype-specific.
  if (vertical === "stay") {
    const subtype = normalizeStaySubtype(vendor?.staySubtype);

    if (!subtype) {
      return "/onboarding";
    }

    return `/vendor/stay/${subtype}`;
  }

  return DASHBOARD_MAP[vertical] || "/onboarding";
};

/* ==========================================================
   DUPLICATE KEY (Mongo E11000) HELPER

   Duplicate checking is now EMAIL-ONLY.
   - Phone numbers are NOT unique (owner / staff may share).
   - Approved / suspended email         => 409 "please login"
   - Pending / rejected + same password => application UPDATED
   - Pending / rejected + other password => 409 (email exists)
========================================================== */

/* Mongo E11000 => readable field + code */
const describeDuplicateKey = (error) => {
  const source = error?.keyPattern || error?.keyValue || {};
  const field = Object.keys(source)[0] || "field";

  if (field === "email") {
    return {
      code: "EMAIL_ALREADY_EXISTS",
      field,
      message: "A vendor account already exists with this email. Please login.",
    };
  }

  if (field === "phone") {
    return {
      code: "PHONE_INDEX_STALE",
      field,
      message:
        "Database still has an old unique index on phone. Run: node scripts/fixVendorIndexes.js",
    };
  }

  return {
    code: "DUPLICATE_VENDOR",
    field,
    message: `Duplicate value for "${field}". Run: node scripts/fixVendorIndexes.js to remove the stale unique index.`,
  };
};

/* ==========================================================
   SIGNUP
========================================================== */

exports.signup = async (req, res) => {
  try {
    const body = req.body || {};

    /* ======================================================
       AUTH DATA
    ====================================================== */

    const email = normalizeEmail(body.email || body.businessEmail);

    const businessEmail = normalizeEmail(body.businessEmail || body.email);

    const phone = normalizePhone(
      body.phone || body.businessPhone || body.ownerPhone
    );

    const password = normalizeString(body.password);

    /* ======================================================
       VALIDATION
    ====================================================== */

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_REQUIRED",
        message: "Email is required",
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        code: "PHONE_REQUIRED",
        message: "Phone number is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_REQUIRED",
        message: "Password is required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_TOO_SHORT",
        message: "Password must be at least 6 characters",
      });
    }

    /* ======================================================
       DUPLICATE CHECK — EMAIL IS THE ONLY IDENTITY
       Phone is NOT a conflict.
    ====================================================== */

    const matches = await Vendor.find({
      $or: [{ email }, { businessEmail: email }],
    }).select("+password");

    let existingApplication = null;

    if (matches.length > 0) {
      const existing = matches.find((m) => m.email === email) || matches[0];

      const currentStatus = String(existing.status || "PENDING").toUpperCase();

      // Approved / suspended account => must login
      if (
        currentStatus === "APPROVED" ||
        currentStatus === "SUSPENDED" ||
        existing.isApproved === true
      ) {
        return res.status(409).json({
          success: false,
          code: "VENDOR_ALREADY_EXISTS",
          status: existing.status || "PENDING",
          isApproved: existing.isApproved === true,
          message:
            "An approved vendor account already exists with this email. Please login.",
        });
      }

      // Pending / rejected: same password => update the application
      const passwordOk = existing.password
        ? await bcrypt.compare(password, existing.password)
        : false;

      if (!passwordOk) {
        return res.status(409).json({
          success: false,
          code: "EMAIL_ALREADY_EXISTS",
          status: existing.status || "PENDING",
          isApproved: false,
          message:
            "An application with this email already exists. Use the same password you registered with, or login.",
        });
      }

      existingApplication = existing;
    }

    /* ======================================================
       SELECTED VERTICAL
    ====================================================== */

    const selectedVertical = normalizeVertical(
      body.selectedVertical || body.vertical || body.service
    );

    if (!selectedVertical || !MAIN_VERTICALS.includes(selectedVertical)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_VERTICAL",
        message: "Please select a valid business vertical.",
      });
    }

    /* ======================================================
       STAY SUBTYPE
    ====================================================== */

    let staySubtype = "";

    if (selectedVertical === "stay") {
      staySubtype = normalizeStaySubtype(
        body.staySubtype ||
          body.subtype ||
          body.propertyType ||
          body.stayDetails?.propertyType
      );

      // Frontend may send: service = hotel
      if (!staySubtype && body.service) {
        staySubtype = normalizeStaySubtype(body.service);
      }

      // Frontend may send: services = ["stay", "hotel"]
      if (!staySubtype && Array.isArray(body.services)) {
        const foundSubtype = body.services.find((item) =>
          normalizeStaySubtype(item)
        );

        if (foundSubtype) {
          staySubtype = normalizeStaySubtype(foundSubtype);
        }
      }

      // Stay must always have subtype.
      if (!staySubtype) {
        return res.status(400).json({
          success: false,
          code: "STAY_SUBTYPE_REQUIRED",
          message: "Please select your stay/property type.",
        });
      }
    }

    /* ======================================================
       SERVICES
    ====================================================== */

    const services = normalizeServices({
      services: body.services || body.service,
      vertical: selectedVertical,
      staySubtype,
    });

    /* ======================================================
       BUSINESS TYPE
    ====================================================== */

    const businessType = normalizeBusinessType(body.businessType);

    if (body.businessType && !businessType) {
      return res.status(400).json({
        success: false,
        code: "INVALID_BUSINESS_TYPE",
        message: `Unsupported business type: ${body.businessType}`,
      });
    }

    /* ======================================================
       VERTICAL DETAILS
       cruise / packages / activities / events / darshan
       (sanitized + required-field validation)
    ====================================================== */

    const { details: verticalDetails, error: verticalError } =
      prepareVerticalDetails(body, selectedVertical);

    if (verticalError) {
      return res.status(400).json({
        success: false,
        code: "INVALID_VERTICAL_DETAILS",
        message: verticalError,
      });
    }

    /* ======================================================
       PASSWORD HASH
    ====================================================== */

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(password, salt);

    /* ======================================================
       STAY DETAILS
    ====================================================== */

    const stayDetails = sanitizeDetails({
      ...(body.stayDetails || {}),
    });

    if (selectedVertical === "stay" && staySubtype) {
      stayDetails.propertyType = staySubtype;
    }

    /* ======================================================
       VENDOR DATA
    ====================================================== */

    const vendorData = {
      /* ---------- ACCOUNT ---------- */
      name: normalizeString(
        body.name || body.ownerName || body.contactName || body.businessName
      ),

      email,
      phone,
      password: hashedPassword,
      role: "owner",
      isOwnerAccount: true,

      /* ---------- VERTICAL ---------- */
      vertical: selectedVertical,
      selectedVertical,
      staySubtype,

      /* ---------- LEGACY SERVICE ---------- */
      services,

      service:
        selectedVertical === "stay"
          ? staySubtype
          : normalizeLegacyService(body.service) ||
            normalizeLegacyService(selectedVertical),

      /* ---------- BUSINESS ---------- */
      businessName: normalizeString(body.businessName),
      legalBusinessName: normalizeString(body.legalBusinessName),
      businessType,
      businessEmail,
      businessPhone: normalizePhone(body.businessPhone || phone),
      website: normalizeString(body.website),
      businessRegistrationNumber: normalizeString(
        body.businessRegistrationNumber
      ),
      taxRegistrationNumber: normalizeString(body.taxRegistrationNumber),
      vatNumber: normalizeString(body.vatNumber),
      gstNumber: normalizeString(body.gstNumber),
      businessLicenseNumber: normalizeString(body.businessLicenseNumber),

      /* ---------- LOCATION ---------- */
      country: normalizeString(body.country),
      countryCode: normalizeString(body.countryCode),
      state: normalizeString(body.state || body.stateProvince || body.region),
      city: normalizeString(body.city),
      district: normalizeString(body.district),
      locality: normalizeString(body.locality),
      landmark: normalizeString(body.landmark),
      addressLine1: normalizeString(body.addressLine1),
      addressLine2: normalizeString(body.addressLine2),
      postalCode: normalizeString(body.postalCode || body.pincode),
      pincode: normalizeString(body.pincode || body.postalCode),
      address: normalizeString(body.address),
      timezone: normalizeString(body.timezone),

      /* ---------- PREFERENCES ---------- */
      preferredLanguage: normalizeString(body.preferredLanguage),
      preferredCurrency: normalizeString(body.preferredCurrency),
      settlementCurrency: normalizeString(body.settlementCurrency),

      /* ---------- OWNER ---------- */
      ownerName: normalizeString(body.ownerName || body.name),
      ownerEmail: normalizeEmail(body.ownerEmail || email),
      ownerPhone: normalizePhone(body.ownerPhone || phone),

      /* ---------- STAY ---------- */
      stayDetails,

      /* ---------- CRUISE / TOURS / ACTIVITIES / EVENTS / DARSHAN ---------- */
      ...verticalDetails,

      /* ---------- ONBOARDING ---------- */
      onboardingStatus: "submitted",
      onboardingComplete: true,
      onboardingStep: 18,
      onboardingProgress: 100,
      onboardingSubmittedAt: new Date(),

      /* ==================================================
         ADMIN APPROVAL

         MOST IMPORTANT: Signup DOES NOT approve vendor.
      ================================================== */
      status: "PENDING",
      isApproved: false,
      isActive: true,
      accountStatus: "active",
    };

    /* ======================================================
       OPTIONAL ONBOARDING FIELDS
    ====================================================== */

    const optionalFields = [
      "businessDescription",
      "communicationNumber",
      "whatsappNumber",
      "ownerDesignation",
      "ownerGovernmentIdType",
      "ownerGovernmentIdNumber",
      "governmentIdType",
      "governmentIdNumber",
      "bankCountry",
      "bankCurrency",
      "bankName",
      "branchName",
      "bankAccountName",
      "bankAccountNumber",
      "bankSwiftCode",
      "bankIban",
      "bankIfscCode",
      "iban",
      "swiftCode",
      "routingNumber",
      "taxCountry",
      "taxType",
      "taxName",
      "taxId",
      "logo",
      "businessLogo",
      "documents",
      "media",
      "documentFiles",
      "contractAccepted",
      "termsAccepted",
      "privacyAccepted",
      "cabDetails",
      "carRentalDetails",
      "busDetails",
      "panNumber",
      "panCardNumber",
      "panCard",
      "aadharNumber",
      "aadharFront",
      "aadharBack",
      "gstRegistrationNumber",
      "gstCertificate",
      "accountHolderName",
      "accountNumber",
      "ifscCode",
      "upiId",
      "cancelledCheque",
      "passbookImage",
      "applicationMeta",
    ];

    optionalFields.forEach((field) => {
      if (body[field] !== undefined) {
        vendorData[field] = sanitizeDetails(body[field]);
      }
    });

    // Never store the confirmation copy of the account number.
    delete vendorData.confirmAccountNumber;

    /* ======================================================
       CREATE  (or UPDATE the same pending application)
    ====================================================== */

    let vendor;
    let resubmitted = false;

    if (existingApplication) {
      // If the applicant switched vertical (e.g. Bus -> Stay),
      // clear the details of the other verticals.
      Object.values(DETAILS_KEY).forEach((key) => {
        if (!verticalDetails[key]) {
          existingApplication.set(key, undefined);
        }
      });

      if (selectedVertical !== "stay") {
        existingApplication.set("staySubtype", "");
      }

      existingApplication.set({
        ...vendorData,
        rejectionReason: "",
        onboardingRejectionReason: "",
        onboardingRejectedAt: null,
      });

      vendor = await existingApplication.save();
      resubmitted = true;
    } else {
      vendor = await Vendor.create(vendorData);
    }

    /* ======================================================
       IMPORTANT: NO TOKEN, NO AUTO LOGIN, NO DASHBOARD ACCESS.
       Admin approval required.
    ====================================================== */

    return res.status(resubmitted ? 200 : 201).json({
      success: true,
      code: resubmitted ? "APPLICATION_UPDATED" : "APPLICATION_SUBMITTED",
      message: resubmitted
        ? "Your existing application was updated and is waiting for admin approval."
        : "Registration submitted successfully. Your BMT Connect vendor application is waiting for admin approval.",
      resubmitted,
      approvalRequired: true,
      status: "PENDING",
      isApproved: false,
      vendor: safeVendorResponse(vendor),
    });
  } catch (error) {
    console.error("❌ Vendor Signup Error:", error);

    /* ---------- DUPLICATE MONGODB ERROR ---------- */
    if (error?.code === 11000) {
      const info = describeDuplicateKey(error);

      console.error(
        "⚠️ Duplicate key:",
        JSON.stringify(error.keyPattern || {}),
        JSON.stringify(error.keyValue || {})
      );

      return res.status(409).json({
        success: false,
        code: info.code,
        conflictField: info.field,
        message: info.message,
      });
    }

    /* ---------- MONGOOSE VALIDATION ERROR ---------- */
    if (error?.name === "ValidationError") {
      const details = Object.values(error.errors || {}).map((item) => ({
        field: item.path,
        value: item.value,
        message: item.message,
      }));

      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message:
          details.map((item) => item.message).join(", ") ||
          "Invalid registration data",
        details,
      });
    }

    return res.status(500).json({
      success: false,
      code: "SIGNUP_FAILED",
      message: error?.message || "Vendor signup failed",
    });
  }
};

/* ==========================================================
   LOGIN

   CRITICAL SECURITY FLOW:

   Correct password alone is NOT enough.

   Vendor MUST also be:
   status = APPROVED
   isApproved = true

   Only then JWT is issued.
========================================================== */

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const normalizedEmail = normalizeEmail(email);

    /* ---------- REQUIRED FIELDS ---------- */
    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_PASSWORD_REQUIRED",
        message: "Email and password are required",
      });
    }

    /* ---------- FIND VENDOR ---------- */
    const vendor = await Vendor.findOne({
      $or: [{ email: normalizedEmail }, { businessEmail: normalizedEmail }],
    }).select("+password");

    if (!vendor) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    /* ---------- VERIFY PASSWORD ---------- */
    const passwordMatch = await bcrypt.compare(
      String(password),
      vendor.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    /* ---------- SUSPENDED ACCOUNT ---------- */
    if (
      String(vendor.accountStatus || "").toLowerCase() === "suspended" ||
      String(vendor.status || "").toUpperCase() === "SUSPENDED"
    ) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        status: "SUSPENDED",
        message:
          "Your BMT Connect vendor account has been suspended. Please contact support.",
      });
    }

    /* ---------- INACTIVE ACCOUNT ---------- */
    if (vendor.isActive === false) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_INACTIVE",
        message: "Your BMT Connect vendor account is inactive.",
      });
    }

    /* ---------- REJECTED APPLICATION ---------- */
    if (
      String(vendor.status || "").toUpperCase() === "REJECTED" ||
      String(vendor.onboardingStatus || "").toLowerCase() === "rejected"
    ) {
      return res.status(403).json({
        success: false,
        code: "APPLICATION_REJECTED",
        status: "REJECTED",
        isApproved: false,
        message:
          "Your BMT Connect vendor application was rejected. Please contact support.",
      });
    }

    /* ======================================================
       ADMIN APPROVAL CHECK  (THE MAIN GATE)

       PENDING vendor cannot login. No JWT is generated.
    ====================================================== */

    const approved =
      String(vendor.status || "").toUpperCase() === "APPROVED" &&
      vendor.isApproved === true;

    if (!approved) {
      return res.status(403).json({
        success: false,
        code: "ADMIN_APPROVAL_REQUIRED",
        approvalRequired: true,
        status: vendor.status || "PENDING",
        isApproved: false,
        message:
          "Your vendor application is waiting for admin approval. You can sign in after BMT Connect approves your application.",
      });
    }

    /* ---------- VERTICAL FROM DATABASE (never trust frontend) ---------- */
    const selectedVertical = normalizeVertical(
      vendor.selectedVertical || vendor.vertical
    );

    if (!selectedVertical || !MAIN_VERTICALS.includes(selectedVertical)) {
      return res.status(403).json({
        success: false,
        code: "VERTICAL_NOT_CONFIGURED",
        message:
          "Your vendor account does not have a valid business vertical.",
      });
    }

    /* ---------- STAY SUBTYPE ---------- */
    let staySubtype = "";

    if (selectedVertical === "stay") {
      staySubtype = normalizeStaySubtype(vendor.staySubtype);

      if (!staySubtype) {
        return res.status(403).json({
          success: false,
          code: "STAY_SUBTYPE_NOT_CONFIGURED",
          message: "Your stay/property subtype is not configured.",
        });
      }
    }

    /* ---------- EXACT DASHBOARD (database decides) ---------- */
    const dashboard = resolveDashboard(vendor);

    if (!dashboard || dashboard === "/onboarding") {
      return res.status(403).json({
        success: false,
        code: "DASHBOARD_NOT_CONFIGURED",
        message: "Dashboard could not be resolved for this vendor account.",
      });
    }

    /* ---------- JWT (only after approval) ---------- */
    const token = createToken(vendor);

    return res.status(200).json({
      success: true,
      code: "LOGIN_SUCCESS",
      message: "Login successful",
      token,
      dashboard,
      vertical: selectedVertical,
      staySubtype: selectedVertical === "stay" ? staySubtype : "",
      vendor: safeVendorResponse(vendor),
    });
  } catch (error) {
    console.error("❌ Vendor Login Error:", error);

    return res.status(500).json({
      success: false,
      code: "LOGIN_FAILED",
      message: error?.message || "Vendor login failed",
    });
  }
};

/* ==========================================================
   GET LOGGED-IN VENDOR PROFILE

   Vendor dashboards (packages / activities / events /
   darshan / cruise) read their onboarding data from
   `vendor.verticalDetails`.
========================================================== */

exports.getVendorProfile = async (req, res) => {
  try {
    const vendorId =
      req.vendor?._id ||
      req.vendor?.id ||
      req.user?._id ||
      req.user?.id ||
      req.vendorId;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      });
    }

    const vendor = await Vendor.findById(vendorId).select("-password");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        code: "VENDOR_NOT_FOUND",
        message: "Vendor not found",
      });
    }

    /*
     * Extra protection: even with an old/stale token,
     * pending/suspended vendor shouldn't receive the profile.
     */
    if (
      String(vendor.status || "").toUpperCase() !== "APPROVED" ||
      vendor.isApproved !== true
    ) {
      return res.status(403).json({
        success: false,
        code: "ADMIN_APPROVAL_REQUIRED",
        message: "Vendor account is not approved.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vendor profile fetched successfully",
      vendor: {
        ...safeVendorResponse(vendor),
        verticalDetails: pickVerticalDetails(vendor),
      },
      dashboard: resolveDashboard(vendor),
    });
  } catch (error) {
    console.error("❌ Vendor Profile Error:", error);

    return res.status(500).json({
      success: false,
      code: "PROFILE_FAILED",
      message: error?.message || "Unable to load vendor profile",
    });
  }
};

/* ==========================================================
   GET ALL VENDORS
========================================================== */

exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({})
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: vendors.length,
      vendors: vendors.map(safeVendorResponse),
    });
  } catch (error) {
    console.error("❌ Get Vendors Error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Unable to load vendors",
    });
  }
};

/* ==========================================================
   GET PENDING VENDORS  (ADMIN PANEL)
========================================================== */

exports.getPendingVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({
      $or: [
        { status: "PENDING" },
        { onboardingStatus: "submitted" },
        { onboardingStatus: "under_review" },
      ],
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: vendors.length,
      vendors: vendors.map(safeVendorResponse),
    });
  } catch (error) {
    console.error("❌ Pending Vendors Error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Unable to load pending vendors",
    });
  }
};

/* ==========================================================
   GET ONE VENDOR WITH FULL APPLICATION  (ADMIN PANEL)

   Admin needs the complete onboarding data (details,
   documents, bank, tax) to approve / reject properly.
========================================================== */

exports.getVendorApplication = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).select("-password");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        code: "VENDOR_NOT_FOUND",
        message: "Vendor not found",
      });
    }

    return res.status(200).json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("❌ Vendor Application Error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Unable to load vendor application",
    });
  }
};

/* ==========================================================
   APPROVE VENDOR  (ADMIN PANEL ACTION)

   After this: vendor CAN login.
========================================================== */

exports.approveVendor = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        code: "VENDOR_NOT_FOUND",
        message: "Vendor not found",
      });
    }

    // Do not approve suspended vendor accidentally.
    if (String(vendor.status || "").toUpperCase() === "SUSPENDED") {
      return res.status(409).json({
        success: false,
        code: "VENDOR_SUSPENDED",
        message: "Suspended vendor cannot be approved directly.",
      });
    }

    vendor.status = "APPROVED";
    vendor.isApproved = true;
    vendor.isActive = true;
    vendor.accountStatus = "active";
    vendor.onboardingStatus = "approved";
    vendor.onboardingComplete = true;
    vendor.onboardingProgress = 100;
    vendor.approvedAt = new Date();
    vendor.onboardingApprovedAt = new Date();

    await vendor.save();

    return res.status(200).json({
      success: true,
      code: "VENDOR_APPROVED",
      message: "Vendor approved successfully. Vendor can now sign in.",
      vendor: safeVendorResponse(vendor),
      dashboard: resolveDashboard(vendor),
    });
  } catch (error) {
    console.error("❌ Approve Vendor Error:", error);

    return res.status(500).json({
      success: false,
      code: "APPROVE_VENDOR_FAILED",
      message: error?.message || "Unable to approve vendor",
    });
  }
};

/* ==========================================================
   REJECT VENDOR  (ADMIN PANEL ACTION)

   Rejected vendor cannot login.
========================================================== */

exports.rejectVendor = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        code: "VENDOR_NOT_FOUND",
        message: "Vendor not found",
      });
    }

    vendor.status = "REJECTED";
    vendor.isApproved = false;
    vendor.onboardingStatus = "rejected";
    vendor.onboardingRejectedAt = new Date();

    if (req.body?.reason !== undefined) {
      const reason = normalizeString(req.body.reason);

      vendor.rejectionReason = reason;
      vendor.onboardingRejectionReason = reason;
    }

    await vendor.save();

    return res.status(200).json({
      success: true,
      code: "VENDOR_REJECTED",
      message: "Vendor rejected successfully",
      vendor: safeVendorResponse(vendor),
    });
  } catch (error) {
    console.error("❌ Reject Vendor Error:", error);

    return res.status(500).json({
      success: false,
      code: "REJECT_VENDOR_FAILED",
      message: error?.message || "Unable to reject vendor",
    });
  }
};