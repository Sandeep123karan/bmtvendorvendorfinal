
const mongoose = require("mongoose");
const Advertisement = require("../models/Advertisement");

const getVendorId = (req) => {
  return (
    req.vendor?._id ||
    req.vendor?.id ||
    req.user?.vendorId ||
    req.user?._id ||
    req.user?.id
  );
};

// CREATE ADVERTISEMENT
exports.createAdvertisement = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required",
      });
    }

    const {
      title,
      description,
      adType,
      targetId,
      budget,
      startDate,
      endDate,
    } = req.body;

    if (!title || !adType || budget == null || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Title, adType, budget, startDate and endDate are required",
      });
    }

    const allowedTypes = [
      "Property",
      "Hotel",
      "Cab",
      "Tour",
      "Activity",
      "Event",
    ];

    if (!allowedTypes.includes(adType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advertisement type",
      });
    }

    const budgetValue = Number(budget);
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!Number.isFinite(budgetValue) || budgetValue < 1) {
      return res.status(400).json({
        success: false,
        message: "Budget must be at least ₹1",
      });
    }

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid dates are required and endDate cannot precede startDate",
      });
    }

    const advertisement = await Advertisement.create({
      vendorId,
      title: title.trim(),
      description: description || "",
      adType,
      targetId:
        targetId && mongoose.isValidObjectId(targetId) ? targetId : null,
      budget: budgetValue,
      startDate: start,
      endDate: end,
      status: "Pending",
    });

    return res.status(201).json({
      success: true,
      message: "Advertisement submitted for approval",
      advertisement,
    });
  } catch (error) {
    console.error("Create advertisement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create advertisement",
    });
  }
};

// GET ALL ADS FOR LOGGED-IN VENDOR
exports.getMyAdvertisements = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required",
      });
    }

    const advertisements = await Advertisement.find({ vendorId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: advertisements.length,
      advertisements,
    });
  } catch (error) {
    console.error("Get advertisements error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch advertisements",
    });
  }
};

// GET ONE AD
exports.getAdvertisementById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advertisement ID",
      });
    }

    const advertisement = await Advertisement.findOne({
      _id: id,
      vendorId,
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found",
      });
    }

    return res.status(200).json({
      success: true,
      advertisement,
    });
  } catch (error) {
    console.error("Get advertisement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch advertisement",
    });
  }
};

// UPDATE AD DETAILS — only while pending or rejected
exports.updateAdvertisement = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advertisement ID",
      });
    }

    const advertisement = await Advertisement.findOne({
      _id: id,
      vendorId,
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found",
      });
    }

    if (!["Pending", "Rejected"].includes(advertisement.status)) {
      return res.status(400).json({
        success: false,
        message: "Only pending or rejected advertisements can be edited",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "adType",
      "targetId",
      "budget",
      "startDate",
      "endDate",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        advertisement[field] = req.body[field];
      }
    }

    if (advertisement.title) {
      advertisement.title = advertisement.title.trim();
    }

    if (advertisement.budget != null) {
      advertisement.budget = Number(advertisement.budget);

      if (
        !Number.isFinite(advertisement.budget) ||
        advertisement.budget < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Budget must be at least ₹1",
        });
      }
    }

    const allowedTypes = [
      "Property",
      "Hotel",
      "Cab",
      "Tour",
      "Activity",
      "Event",
    ];

    if (!allowedTypes.includes(advertisement.adType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advertisement type",
      });
    }

    if (
      !advertisement.startDate ||
      !advertisement.endDate ||
      new Date(advertisement.endDate) < new Date(advertisement.startDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid start and end dates are required",
      });
    }

    // Re-submit edited rejected ads for approval
    if (advertisement.status === "Rejected") {
      advertisement.status = "Pending";
    }

    await advertisement.save();

    return res.status(200).json({
      success: true,
      message: "Advertisement updated successfully",
      advertisement,
    });
  } catch (error) {
    console.error("Update advertisement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update advertisement",
    });
  }
};

// PAUSE / RESUME AD
exports.toggleAdvertisementStatus = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;
    const { status } = req.body;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advertisement ID",
      });
    }

    if (!["Active", "Paused"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Active or Paused",
      });
    }

    const advertisement = await Advertisement.findOne({
      _id: id,
      vendorId,
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found",
      });
    }

    // Vendor cannot approve their own ad or reactivate an unapproved ad.
    if (status === "Active" && advertisement.status !== "Paused") {
      return res.status(400).json({
        success: false,
        message: "Only an approved, paused advertisement can be resumed",
      });
    }

    if (status === "Paused" && advertisement.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Only active advertisements can be paused",
      });
    }

    advertisement.status = status;
    await advertisement.save();

    return res.status(200).json({
      success: true,
      message: `Advertisement ${status.toLowerCase()} successfully`,
      advertisement,
    });
  } catch (error) {
    console.error("Toggle advertisement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to change advertisement status",
    });
  }
};

// DELETE OWN AD
exports.deleteAdvertisement = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication is required",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advertisement ID",
      });
    }

    const advertisement = await Advertisement.findOne({
      _id: id,
      vendorId,
    });

    if (!advertisement) {
      return res.status(404).json({
        success: false,
        message: "Advertisement not found",
      });
    }

    if (["Active", "Paused"].includes(advertisement.status)) {
      return res.status(400).json({
        success: false,
        message: "Pause or complete this advertisement before deleting it",
      });
    }

    await advertisement.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Advertisement deleted successfully",
    });
  } catch (error) {
    console.error("Delete advertisement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete advertisement",
    });
  }
};
