
const mongoose = require("mongoose");
const VendorOffer = require("../models/VendorOffer");

// Get authenticated vendor ID.
// Adjusted defensively for common auth middleware patterns.
const getVendorId = (req) => {
  return (
    req.vendor?._id ||
    req.vendor?.id ||
    req.user?.vendorId ||
    req.user?._id ||
    req.user?.id
  );
};

// CREATE OFFER
exports.createOffer = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Authenticated vendor ID not found",
      });
    }

    const {
      title,
      description,
      code,
      discountType,
      discountValue,
      minimumBookingAmount,
      maximumDiscount,
      vertical,
      startDate,
      endDate,
      usageLimit,
    } = req.body;

    if (
      !title ||
      !code ||
      !discountType ||
      discountValue == null ||
      !vertical ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required offer fields",
      });
    }

    const normalizedCode = String(code).trim().toUpperCase();

    const duplicate = await VendorOffer.findOne({
      vendorId,
      code: normalizedCode,
      isDeleted: false,
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "You already have an offer with this coupon code",
      });
    }

    const offer = await VendorOffer.create({
      vendorId,
      title,
      description,
      code: normalizedCode,
      discountType,
      discountValue,
      minimumBookingAmount,
      maximumDiscount:
        maximumDiscount === "" || maximumDiscount == null
          ? null
          : maximumDiscount,
      vertical,
      startDate,
      endDate,
      usageLimit:
        usageLimit === "" || usageLimit == null
          ? null
          : usageLimit,
      // Vendor-created offers require approval.
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Offer submitted for admin approval",
      offer,
    });
  } catch (error) {
    console.error("Create offer error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This coupon code already exists for your account",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create offer",
      error: error.message,
    });
  }
};

// GET LOGGED-IN VENDOR'S OFFERS
exports.getMyOffers = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Authenticated vendor ID not found",
      });
    }

    const { status, vertical } = req.query;

    const filter = {
      vendorId,
      isDeleted: false,
    };

    const allowedStatuses = [
      "pending",
      "active",
      "paused",
      "rejected",
      "expired",
    ];

    if (status && allowedStatuses.includes(status)) {
      filter.status = status;
    }

    if (vertical) {
      filter.vertical = vertical;
    }

    // Expire offers that have passed their end date.
    await VendorOffer.updateMany(
      {
        vendorId,
        isDeleted: false,
        status: { $in: ["active", "paused"] },
        endDate: { $lte: new Date() },
      },
      { $set: { status: "expired" } }
    );

    const offers = await VendorOffer.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: offers.length,
      offers,
    });
  } catch (error) {
    console.error("Get offers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch offers",
    });
  }
};

// UPDATE OFFER
exports.updateOffer = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Authenticated vendor ID not found",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID",
      });
    }

    const offer = await VendorOffer.findOne({
      _id: id,
      vendorId,
      isDeleted: false,
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // Once approved, offers cannot be edited by vendors.
    if (offer.status === "active" || offer.status === "expired") {
      return res.status(403).json({
        success: false,
        message: "Active or expired offers cannot be edited",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "discountType",
      "discountValue",
      "minimumBookingAmount",
      "maximumDiscount",
      "vertical",
      "startDate",
      "endDate",
      "usageLimit",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        offer.set(field, req.body[field] === "" ? null : req.body[field]);
      }
    }

    if (req.body.code !== undefined) {
      offer.code = String(req.body.code).trim().toUpperCase();
    }

    // Edited/rejected offers must go through approval again.
    offer.status = "pending";
    offer.rejectionReason = "";

    await offer.save();

    return res.status(200).json({
      success: true,
      message: "Offer updated and submitted for approval",
      offer,
    });
  } catch (error) {
    console.error("Update offer error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This coupon code already exists",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update offer",
    });
  }
};

// PAUSE / RESUME OFFER
exports.toggleOfferStatus = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Authenticated vendor ID not found",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID",
      });
    }

    const offer = await VendorOffer.findOne({
      _id: id,
      vendorId,
      isDeleted: false,
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    if (!["active", "paused"].includes(offer.status)) {
      return res.status(400).json({
        success: false,
        message: "Only active offers can be paused or resumed",
      });
    }

    if (new Date(offer.endDate) <= new Date()) {
      offer.status = "expired";
      await offer.save();

      return res.status(400).json({
        success: false,
        message: "This offer has expired",
      });
    }

    offer.status = offer.status === "active" ? "paused" : "active";
    await offer.save();

    return res.status(200).json({
      success: true,
      message: `Offer ${offer.status} successfully`,
      offer,
    });
  } catch (error) {
    console.error("Toggle offer status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to change offer status",
    });
  }
};

// SOFT DELETE OFFER
exports.deleteOffer = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Authenticated vendor ID not found",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID",
      });
    }

    const offer = await VendorOffer.findOne({
      _id: id,
      vendorId,
      isDeleted: false,
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    if (offer.status === "active") {
      return res.status(403).json({
        success: false,
        message: "Pause the offer before deleting it",
      });
    }

    offer.isDeleted = true;
    await offer.save();

    return res.status(200).json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error) {
    console.error("Delete offer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete offer",
    });
  }
};
