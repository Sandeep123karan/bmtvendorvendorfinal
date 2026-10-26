// const Apartment = require("../models/Apartment.model");
// const cloudinary = require("../config/cloudinary");


// const parseJSON = (val, fallback) => {
//   try {
//     if (typeof val === "string") {
//       return JSON.parse(val);
//     }

//     return val ?? fallback;
//   } catch {
//     return fallback;
//   }
// };


// const parseBoolean = (value, fallback = false) => {
//   if (value === undefined || value === null || value === "") {
//     return fallback;
//   }

//   if (typeof value === "boolean") {
//     return value;
//   }

//   return String(value).toLowerCase() === "true";
// };


// const parseNumber = (value, fallback = null) => {
//   if (value === undefined || value === null || value === "") {
//     return fallback;
//   }

//   const number = Number(value);

//   return Number.isNaN(number) ? fallback : number;
// };
// const uploadImages = (files = []) =>
//   Promise.all(
//     files.map(
//       (file) =>
//         new Promise((resolve, reject) => {
//           const stream = cloudinary.uploader.upload_stream(
//             { folder: "vendor-apartments", resource_type: "image" },
//             (err, result) => (err ? reject(err) : resolve(result.secure_url))
//           );
//           stream.end(file.buffer);
//         })
//     )
//   );
// /* =====================================================
//    CREATE APARTMENT
// ===================================================== */
// exports.createApartment = async (req, res) => {
//   try {
//     const b = req.body;

//     const imageUrls = await uploadImages(req.files || []);

//     const apartment = await Apartment.create({
//       vendor: req.vendor._id,

//       // BASIC
//       apartmentName: b.apartmentName,
//       propertyType: b.propertyType || "Apartment",
//       shortDescription: b.shortDescription || "",
//       description: b.description || "",
//       hostName: b.hostName || "",

//       // CONTACT
//       phone: b.phone || "",
//       altPhone: b.altPhone || "",
//       email: b.email || "",

//       // LOCATION
//       country: b.country || "India",
//       state: b.state || "",
//       city: b.city || "",
//       area: b.area || "",
//       address: b.address || "",
//       pincode: b.pincode || "",
//       landmark: b.landmark || "",

//       mapLocation: {
//         lat: parseNumber(b.lat),
//         lng: parseNumber(b.lng),
//       },

//       // BUILDING
//       buildingName: b.buildingName || "",
//       towerName: b.towerName || "",
//       floorNumber: parseNumber(b.floorNumber),
//       totalFloors: parseNumber(b.totalFloors),
//       flatNumber: b.flatNumber || "",
//       societyName: b.societyName || "",

//       // CONFIGURATION
//       apartmentType: b.apartmentType || "1BHK",
//       furnishing: b.furnishing || "Fully Furnished",
//       carpetArea: parseNumber(b.carpetArea),
//       superArea: parseNumber(b.superArea),
//       areaUnit: b.areaUnit || "sqft",

//       bedrooms: parseNumber(b.bedrooms, 1),
//       hall: parseNumber(b.hall, 1),
//       kitchen: parseNumber(b.kitchen, 1),
//       bathrooms: parseNumber(b.bathrooms, 1),
//       balcony: parseNumber(b.balcony, 0),

//       maxGuests: parseNumber(b.maxGuests, 2),
//       maxAdults: parseNumber(b.maxAdults, 2),
//       maxChildren: parseNumber(b.maxChildren, 0),
//       beds: parseNumber(b.beds, 1),

//       // BED CONFIGURATION
//       bedConfiguration: parseJSON(
//         b.bedConfiguration,
//         []
//       ),

//       // EXTRAS
//       extraMattressAllowed: parseBoolean(
//         b.extraMattressAllowed
//       ),

//       maxExtraMattress: parseNumber(
//         b.maxExtraMattress,
//         0
//       ),

//       childrenAllowed: parseBoolean(
//         b.childrenAllowed
//       ),

//       petsAllowed: parseBoolean(
//         b.petsAllowed
//       ),

//       // CHECK-IN / OUT
//       checkInTime: b.checkInTime || "14:00",
//       checkOutTime: b.checkOutTime || "11:00",

//       // AMENITIES
//       amenities: parseJSON(b.amenities, []),

//       // FOOD
//       kitchenAvailable: parseBoolean(
//         b.kitchenAvailable
//       ),

//       selfCookingAllowed: parseBoolean(
//         b.selfCookingAllowed
//       ),

//       vegFoodAvailable: parseBoolean(
//         b.vegFoodAvailable
//       ),

//       nonVegAllowed: parseBoolean(
//         b.nonVegAllowed
//       ),

//       mealPlan: b.mealPlan || "Room Only",

//       // PRICING
//       pricing: {
//         basePrice: parseNumber(
//           b.basePrice,
//           0
//         ),

//         monthlyPrice: parseNumber(
//           b.monthlyPrice,
//           0
//         ),

//         weekendPrice: parseNumber(
//           b.weekendPrice,
//           0
//         ),

//         extraGuestPrice: parseNumber(
//           b.extraGuestPrice,
//           0
//         ),

//         extraMattressPrice: parseNumber(
//           b.extraMattressPrice,
//           0
//         ),

//         cleaningFee: parseNumber(
//           b.cleaningFee,
//           0
//         ),

//         securityDeposit: parseNumber(
//           b.securityDeposit,
//           0
//         ),

//         currency: b.currency || "INR",
//       },

//       // ROOM TYPE
//       roomType:
//         b.roomType || "Entire Apartment",

//       totalUnits: parseNumber(
//         b.totalUnits,
//         1
//       ),

//       // AVAILABILITY
//       availableFrom: b.availableFrom || null,
//       availableTo: b.availableTo || null,

//       // RULES
//       houseRules: parseJSON(
//         b.houseRules,
//         {}
//       ),

//       cancellationPolicy:
//         b.cancellationPolicy || "",

//       // MEDIA
//       thumbnail: imageUrls[0] || "",
//       images: imageUrls,

//       // META
//       notes: b.notes || "",

//       // Vendor should NOT control approval
//       status: "pending",
//     });


//     return res.status(201).json({
//       success: true,
//       message: "Apartment created successfully. Waiting for approval.",
//       data: apartment,
//     });

//   } catch (error) {
//     console.error(
//       "CREATE APARTMENT ERROR:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// /* =====================================================
//    GET MY APARTMENTS
// ===================================================== */
// exports.getMyApartments = async (req, res) => {
//   try {
//     const apartments = await Apartment.find({ vendor: req.vendor._id }).sort({ createdAt: -1 });
//     res.json({ success: true, data: apartments });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// /* =====================================================
//    GET SINGLE APARTMENT
// ===================================================== */
// exports.getApartmentById = async (req, res) => {
//   try {
//     const apartment = await Apartment.findOne({ _id: req.params.id, vendor: req.vendor._id });
//     if (!apartment) return res.status(404).json({ success: false, message: "Not found" });
//     res.json({ success: true, data: apartment });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// /* =====================================================
//    UPDATE APARTMENT
//    (status & vendor fields are protected)
// ===================================================== */
// // exports.updateApartment = async (req, res) => {
// //   try {
// //     const b = req.body;

// //     const existing = await Apartment.findOne({ _id: req.params.id, vendor: req.vendor._id });
// //     if (!existing) return res.status(404).json({ success: false, message: "Not found" });

// //     // Upload new images and merge with existing
// //     let imageUrls = existing.images || [];
// //     if (req.files && req.files.length > 0) {
// //       const newUrls = [];
// //       for (let file of req.files) {
// //         const result = await cloudinary.uploader.upload(file.path, { folder: "vendor-apartments" });
// //         newUrls.push(result.secure_url);
// //       }
// //       imageUrls = [...imageUrls, ...newUrls];
// //     }

// //     // Strip protected fields
// //     const { status, vendor, ...updateData } = b;

// //     const updated = await Apartment.findByIdAndUpdate(
// //       req.params.id,
// //       {
// //         ...updateData,
// //         amenities: b.amenities ? parseJSON(b.amenities, []) : existing.amenities,
// //         houseRules: b.houseRules ? parseJSON(b.houseRules, {}) : existing.houseRules,
// //         pricing: {
// //           basePrice: b.basePrice ?? existing.pricing?.basePrice,
// //           monthlyPrice: b.monthlyPrice ?? existing.pricing?.monthlyPrice,
// //           weekendPrice: b.weekendPrice ?? existing.pricing?.weekendPrice,
// //           extraGuestPrice: b.extraGuestPrice ?? existing.pricing?.extraGuestPrice,
// //           cleaningFee: b.cleaningFee ?? existing.pricing?.cleaningFee,
// //           securityDeposit: b.securityDeposit ?? existing.pricing?.securityDeposit,
// //         },
// //         mapLocation: {
// //           lat: b.lat ?? existing.mapLocation?.lat,
// //           lng: b.lng ?? existing.mapLocation?.lng,
// //         },
// //         thumbnail: imageUrls[0] || existing.thumbnail,
// //         images: imageUrls,
// //       },
// //       { new: true }
// //     );

// //     res.json({ success: true, data: updated });
// //   } catch (error) {
// //     console.error("❌ UPDATE APARTMENT ERROR:", error);
// //     res.status(500).json({ success: false, message: error.message });
// //   }
// // };
// exports.updateApartment = async (req, res) => {
//   try {
//     const b = req.body;

//     const existing = await Apartment.findOne({
//       _id: req.params.id,
//       vendor: req.vendor._id,
//     });
//     if (!existing) {
//       return res.status(404).json({ success: false, message: "Not found" });
//     }

//     // New images upload karke purani ke saath merge
//     const newUrls = await uploadImages(req.files || []);
//     const imageUrls = [...(existing.images || []), ...newUrls];

//     const str = (v, old) => (v === undefined ? old : v);
//     const num = (v, old) => (v === undefined ? old : parseNumber(v, old));
//     const bool = (v, old) => (v === undefined ? old : parseBoolean(v, old));
//     const ex = existing.pricing || {};

//     const updateData = {
//       apartmentName: str(b.apartmentName, existing.apartmentName),
//       propertyType: str(b.propertyType, existing.propertyType),
//       description: str(b.description, existing.description),
//       hostName: str(b.hostName, existing.hostName),

//       phone: str(b.phone, existing.phone),
//       altPhone: str(b.altPhone, existing.altPhone),
//       email: str(b.email, existing.email),

//       country: str(b.country, existing.country),
//       state: str(b.state, existing.state),
//       city: str(b.city, existing.city),
//       area: str(b.area, existing.area),
//       address: str(b.address, existing.address),
//       pincode: str(b.pincode, existing.pincode),
//       landmark: str(b.landmark, existing.landmark),

//       mapLocation: {
//         lat: num(b.lat, existing.mapLocation?.lat ?? null),
//         lng: num(b.lng, existing.mapLocation?.lng ?? null),
//       },

//       buildingName: str(b.buildingName, existing.buildingName),
//       towerName: str(b.towerName, existing.towerName),
//       floorNumber: num(b.floorNumber, existing.floorNumber),
//       totalFloors: num(b.totalFloors, existing.totalFloors),
//       flatNumber: str(b.flatNumber, existing.flatNumber),
//       societyName: str(b.societyName, existing.societyName),

//       apartmentType: str(b.apartmentType, existing.apartmentType),
//       furnishing: str(b.furnishing, existing.furnishing),
//       carpetArea: num(b.carpetArea, existing.carpetArea),
//       superArea: num(b.superArea, existing.superArea),

//       bedrooms: num(b.bedrooms, existing.bedrooms),
//       hall: num(b.hall, existing.hall),
//       kitchen: num(b.kitchen, existing.kitchen),
//       bathrooms: num(b.bathrooms, existing.bathrooms),
//       balcony: num(b.balcony, existing.balcony),
//       maxGuests: num(b.maxGuests, existing.maxGuests),
//       beds: num(b.beds, existing.beds),

//       extraMattressAllowed: bool(b.extraMattressAllowed, existing.extraMattressAllowed),
//       childrenAllowed: bool(b.childrenAllowed, existing.childrenAllowed),
//       petsAllowed: bool(b.petsAllowed, existing.petsAllowed),

//       kitchenAvailable: bool(b.kitchenAvailable, existing.kitchenAvailable),
//       selfCookingAllowed: bool(b.selfCookingAllowed, existing.selfCookingAllowed),
//       vegFoodAvailable: bool(b.vegFoodAvailable, existing.vegFoodAvailable),
//       nonVegAllowed: bool(b.nonVegAllowed, existing.nonVegAllowed),

//       checkInTime: str(b.checkInTime, existing.checkInTime),
//       checkOutTime: str(b.checkOutTime, existing.checkOutTime),
//       availableFrom: b.availableFrom === undefined ? existing.availableFrom : b.availableFrom || null,
//       availableTo: b.availableTo === undefined ? existing.availableTo : b.availableTo || null,

//       roomType: str(b.roomType, existing.roomType),
//       mealPlan: str(b.mealPlan, existing.mealPlan),
//       cancellationPolicy: str(b.cancellationPolicy, existing.cancellationPolicy),
//       notes: str(b.notes, existing.notes),

//       amenities: b.amenities ? parseJSON(b.amenities, []) : existing.amenities,
//       houseRules: b.houseRules ? parseJSON(b.houseRules, {}) : existing.houseRules,

//       pricing: {
//         basePrice: num(b.basePrice, ex.basePrice ?? 0),
//         monthlyPrice: num(b.monthlyPrice, ex.monthlyPrice ?? 0),
//         weekendPrice: num(b.weekendPrice, ex.weekendPrice ?? 0),
//         extraGuestPrice: num(b.extraGuestPrice, ex.extraGuestPrice ?? 0),
//         extraMattressPrice: ex.extraMattressPrice ?? 0,
//         cleaningFee: num(b.cleaningFee, ex.cleaningFee ?? 0),
//         securityDeposit: num(b.securityDeposit, ex.securityDeposit ?? 0),
//         currency: ex.currency || "INR",
//       },

//       thumbnail: imageUrls[0] || existing.thumbnail,
//       images: imageUrls,
//     };

//     // status / vendor jaan-bujh kar nahi liye (protected)
//     const updated = await Apartment.findByIdAndUpdate(
//       req.params.id,
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     res.json({ success: true, data: updated });
//   } catch (error) {
//     console.error("UPDATE APARTMENT ERROR:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
// /* =====================================================
//    DELETE APARTMENT
// ===================================================== */
// exports.deleteApartment = async (req, res) => {
//   try {
//     const deleted = await Apartment.findOneAndDelete({ _id: req.params.id, vendor: req.vendor._id });
//     if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
//     res.json({ success: true, message: "Apartment deleted" });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// /* =====================================================
//    TOGGLE ACTIVE / INACTIVE
//    (only approved listings can be toggled by vendor)
// ===================================================== */
// exports.toggleActiveStatus = async (req, res) => {
//   try {
//     const apartment = await Apartment.findOne({ _id: req.params.id, vendor: req.vendor._id });
//     if (!apartment) return res.status(404).json({ success: false, message: "Not found" });

//     if (apartment.status !== "approved" && apartment.status !== "inactive") {
//       return res.status(400).json({ success: false, message: "Only approved apartments can be toggled" });
//     }

//     apartment.status = apartment.status === "approved" ? "inactive" : "approved";
//     await apartment.save();

//     res.json({ success: true, data: apartment });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

const Apartment = require("../models/Apartment.model");
const cloudinary = require("../config/cloudinary");

/* ================= HELPERS ================= */

const parseJSON = (val, fallback) => {
  try {
    if (typeof val === "string") return JSON.parse(val);
    return val ?? fallback;
  } catch {
    return fallback;
  }
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const parseNumber = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isNaN(number) ? fallback : number;
};

const uploadImages = (files = []) =>
  Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "vendor-apartments", resource_type: "image" },
            (err, result) => (err ? reject(err) : resolve(result.secure_url))
          );
          stream.end(file.buffer);
        })
    )
  );

/* =====================================================
   CREATE APARTMENT
   Approval nahi hai: apartment seedha "active" ban jata hai
===================================================== */
exports.createApartment = async (req, res) => {
  try {
    const b = req.body;

    if (!b.apartmentName || !String(b.apartmentName).trim()) {
      return res.status(400).json({ success: false, message: "Apartment name is required" });
    }

    const imageUrls = await uploadImages(req.files || []);

    const apartment = await Apartment.create({
      vendor: req.vendor._id,

      // BASIC
      apartmentName: b.apartmentName,
      propertyType: b.propertyType || "Apartment",
      shortDescription: b.shortDescription || "",
      description: b.description || "",
      hostName: b.hostName || "",

      // CONTACT
      phone: b.phone || "",
      altPhone: b.altPhone || "",
      email: b.email || "",

      // LOCATION
      country: b.country || "India",
      state: b.state || "",
      city: b.city || "",
      area: b.area || "",
      address: b.address || "",
      pincode: b.pincode || "",
      landmark: b.landmark || "",
      mapLocation: { lat: parseNumber(b.lat), lng: parseNumber(b.lng) },

      // BUILDING
      buildingName: b.buildingName || "",
      towerName: b.towerName || "",
      floorNumber: parseNumber(b.floorNumber),
      totalFloors: parseNumber(b.totalFloors),
      flatNumber: b.flatNumber || "",
      societyName: b.societyName || "",

      // CONFIGURATION
      apartmentType: b.apartmentType || "1BHK",
      furnishing: b.furnishing || "Fully Furnished",
      carpetArea: parseNumber(b.carpetArea),
      superArea: parseNumber(b.superArea),
      areaUnit: b.areaUnit || "sqft",
      bedrooms: parseNumber(b.bedrooms, 1),
      hall: parseNumber(b.hall, 1),
      kitchen: parseNumber(b.kitchen, 1),
      bathrooms: parseNumber(b.bathrooms, 1),
      balcony: parseNumber(b.balcony, 0),
      maxGuests: parseNumber(b.maxGuests, 2),
      maxAdults: parseNumber(b.maxAdults, 2),
      maxChildren: parseNumber(b.maxChildren, 0),
      beds: parseNumber(b.beds, 1),
      bedConfiguration: parseJSON(b.bedConfiguration, []),

      // EXTRAS
      extraMattressAllowed: parseBoolean(b.extraMattressAllowed),
      maxExtraMattress: parseNumber(b.maxExtraMattress, 0),
      childrenAllowed: parseBoolean(b.childrenAllowed),
      petsAllowed: parseBoolean(b.petsAllowed),

      // CHECK-IN / OUT
      checkInTime: b.checkInTime || "14:00",
      checkOutTime: b.checkOutTime || "11:00",

      // AMENITIES
      amenities: parseJSON(b.amenities, []),

      // FOOD
      kitchenAvailable: parseBoolean(b.kitchenAvailable),
      selfCookingAllowed: parseBoolean(b.selfCookingAllowed),
      vegFoodAvailable: parseBoolean(b.vegFoodAvailable),
      nonVegAllowed: parseBoolean(b.nonVegAllowed),
      mealPlan: b.mealPlan || "Room Only",

      // PRICING
      pricing: {
        basePrice: parseNumber(b.basePrice, 0),
        monthlyPrice: parseNumber(b.monthlyPrice, 0),
        weekendPrice: parseNumber(b.weekendPrice, 0),
        extraGuestPrice: parseNumber(b.extraGuestPrice, 0),
        extraMattressPrice: parseNumber(b.extraMattressPrice, 0),
        cleaningFee: parseNumber(b.cleaningFee, 0),
        securityDeposit: parseNumber(b.securityDeposit, 0),
        currency: b.currency || "INR",
      },

      // ROOM TYPE
      roomType: b.roomType || "Entire Apartment",
      totalUnits: parseNumber(b.totalUnits, 1),

      // AVAILABILITY
      availableFrom: b.availableFrom || null,
      availableTo: b.availableTo || null,

      // RULES
      houseRules: parseJSON(b.houseRules, {}),
      cancellationPolicy: b.cancellationPolicy || "",

      // MEDIA
      thumbnail: imageUrls[0] || "",
      images: imageUrls,

      // META
      notes: b.notes || "",

      // FIX: pehle "pending" tha. Ab seedha live.
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Apartment added successfully.",
      data: apartment,
    });
  } catch (error) {
    console.error("CREATE APARTMENT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   GET MY APARTMENTS
===================================================== */
exports.getMyApartments = async (req, res) => {
  try {
    const apartments = await Apartment.find({
      vendor: req.vendor._id,
      isDeleted: { $ne: true },
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: apartments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   GET SINGLE APARTMENT
===================================================== */
exports.getApartmentById = async (req, res) => {
  try {
    const apartment = await Apartment.findOne({ _id: req.params.id, vendor: req.vendor._id });
    if (!apartment) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: apartment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   UPDATE APARTMENT
   - status & vendor protected nahi chhede jate
   - purani photo remove karne ke liye `removedImages` (JSON array of urls)
===================================================== */
exports.updateApartment = async (req, res) => {
  try {
    const b = req.body;

    const existing = await Apartment.findOne({ _id: req.params.id, vendor: req.vendor._id });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Photos: removed hatao, nayi upload karke jodo
    const removed = parseJSON(b.removedImages, []);
    const kept = (existing.images || []).filter((url) => !removed.includes(url));
    const newUrls = await uploadImages(req.files || []);
    const imageUrls = [...kept, ...newUrls];

    if (imageUrls.length === 0) {
      return res.status(400).json({ success: false, message: "At least one photo is required" });
    }

    const str = (v, old) => (v === undefined ? old : v);
    const num = (v, old) => (v === undefined ? old : parseNumber(v, old));
    const bool = (v, old) => (v === undefined ? old : parseBoolean(v, old));
    const ex = existing.pricing || {};

    const updateData = {
      apartmentName: str(b.apartmentName, existing.apartmentName),
      propertyType: str(b.propertyType, existing.propertyType),
      description: str(b.description, existing.description),
      hostName: str(b.hostName, existing.hostName),

      phone: str(b.phone, existing.phone),
      altPhone: str(b.altPhone, existing.altPhone),
      email: str(b.email, existing.email),

      country: str(b.country, existing.country),
      state: str(b.state, existing.state),
      city: str(b.city, existing.city),
      area: str(b.area, existing.area),
      address: str(b.address, existing.address),
      pincode: str(b.pincode, existing.pincode),
      landmark: str(b.landmark, existing.landmark),

      mapLocation: {
        lat: num(b.lat, existing.mapLocation?.lat ?? null),
        lng: num(b.lng, existing.mapLocation?.lng ?? null),
      },

      buildingName: str(b.buildingName, existing.buildingName),
      towerName: str(b.towerName, existing.towerName),
      floorNumber: num(b.floorNumber, existing.floorNumber),
      totalFloors: num(b.totalFloors, existing.totalFloors),
      flatNumber: str(b.flatNumber, existing.flatNumber),
      societyName: str(b.societyName, existing.societyName),

      apartmentType: str(b.apartmentType, existing.apartmentType),
      furnishing: str(b.furnishing, existing.furnishing),
      carpetArea: num(b.carpetArea, existing.carpetArea),
      superArea: num(b.superArea, existing.superArea),

      bedrooms: num(b.bedrooms, existing.bedrooms),
      hall: num(b.hall, existing.hall),
      kitchen: num(b.kitchen, existing.kitchen),
      bathrooms: num(b.bathrooms, existing.bathrooms),
      balcony: num(b.balcony, existing.balcony),
      maxGuests: num(b.maxGuests, existing.maxGuests),
      beds: num(b.beds, existing.beds),

      extraMattressAllowed: bool(b.extraMattressAllowed, existing.extraMattressAllowed),
      childrenAllowed: bool(b.childrenAllowed, existing.childrenAllowed),
      petsAllowed: bool(b.petsAllowed, existing.petsAllowed),

      kitchenAvailable: bool(b.kitchenAvailable, existing.kitchenAvailable),
      selfCookingAllowed: bool(b.selfCookingAllowed, existing.selfCookingAllowed),
      vegFoodAvailable: bool(b.vegFoodAvailable, existing.vegFoodAvailable),
      nonVegAllowed: bool(b.nonVegAllowed, existing.nonVegAllowed),

      checkInTime: str(b.checkInTime, existing.checkInTime),
      checkOutTime: str(b.checkOutTime, existing.checkOutTime),
      availableFrom: b.availableFrom === undefined ? existing.availableFrom : b.availableFrom || null,
      availableTo: b.availableTo === undefined ? existing.availableTo : b.availableTo || null,

      roomType: str(b.roomType, existing.roomType),
      mealPlan: str(b.mealPlan, existing.mealPlan),
      cancellationPolicy: str(b.cancellationPolicy, existing.cancellationPolicy),
      notes: str(b.notes, existing.notes),

      amenities: b.amenities ? parseJSON(b.amenities, []) : existing.amenities,
      houseRules: b.houseRules ? parseJSON(b.houseRules, {}) : existing.houseRules,

      pricing: {
        basePrice: num(b.basePrice, ex.basePrice ?? 0),
        monthlyPrice: num(b.monthlyPrice, ex.monthlyPrice ?? 0),
        weekendPrice: num(b.weekendPrice, ex.weekendPrice ?? 0),
        extraGuestPrice: num(b.extraGuestPrice, ex.extraGuestPrice ?? 0),
        extraMattressPrice: ex.extraMattressPrice ?? 0,
        cleaningFee: num(b.cleaningFee, ex.cleaningFee ?? 0),
        securityDeposit: num(b.securityDeposit, ex.securityDeposit ?? 0),
        currency: ex.currency || "INR",
      },

      thumbnail: imageUrls[0],
      images: imageUrls,
    };

    // status / vendor yahan nahi badalte (toggle API se hi status badalta hai)
    const updated = await Apartment.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("UPDATE APARTMENT ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   DELETE APARTMENT
===================================================== */
exports.deleteApartment = async (req, res) => {
  try {
    const deleted = await Apartment.findOneAndDelete({ _id: req.params.id, vendor: req.vendor._id });
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Apartment deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   TOGGLE ACTIVE / INACTIVE
   Vendor kabhi bhi apni apartment on/off kar sakta hai
===================================================== */
exports.toggleActiveStatus = async (req, res) => {
  try {
    const apartment = await Apartment.findOne({ _id: req.params.id, vendor: req.vendor._id });
    if (!apartment) return res.status(404).json({ success: false, message: "Not found" });

    apartment.status = apartment.status === "inactive" ? "active" : "inactive";
    await apartment.save();

    res.json({ success: true, data: apartment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};