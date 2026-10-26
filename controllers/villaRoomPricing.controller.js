
const mongoose = require("mongoose");
const VillaRoomPricing = require("../models/VillaRoomPricing");

const validId = (id) => mongoose.isValidObjectId(id);

const parseDate = (value) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);

  return date.toISOString().slice(0, 10) === value
    ? date
    : null;
};

// GET all pricing rules for a room
exports.getPricing = async (req, res) => {
  try {
    const { villaId, roomId } = req.params;

    if (!validId(villaId) || !validId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Valid villaId and roomId are required.",
      });
    }

    const pricing = await VillaRoomPricing.find({
      villaId,
      roomId,
    }).sort({ startDate: 1, createdAt: -1 });

    return res.json({
      success: true,
      count: pricing.length,
      pricing,
    });
  } catch (error) {
    console.error("getPricing:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch room pricing.",
    });
  }
};

// CREATE pricing rule
exports.createPricing = async (req, res) => {
  try {
    const { villaId, roomId } = req.params;
    const {
      pricePerNight,
      maxGuests,
      adults = 2,
      children = 0,
      extraGuestPrice = 0,
      startDate,
      endDate,
    } = req.body;

    if (!validId(villaId) || !validId(roomId)) {
      return res.status(400).json({
        success: false,
        message: "Valid villaId and roomId are required.",
      });
    }

    if (
      !Number.isFinite(pricePerNight) ||
      pricePerNight < 0 ||
      !Number.isInteger(maxGuests) ||
      maxGuests < 1 ||
      !Number.isInteger(adults) ||
      adults < 1 ||
      !Number.isInteger(children) ||
      children < 0 ||
      !Number.isFinite(extraGuestPrice) ||
      extraGuestPrice < 0 ||
      adults + children > maxGuests
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid price or guest capacity values.",
      });
    }

    let parsedStart = null;
    let parsedEnd = null;

    if (startDate || endDate) {
      parsedStart = parseDate(startDate);
      parsedEnd = parseDate(endDate);

      if (
        !parsedStart ||
        !parsedEnd ||
        parsedStart > parsedEnd
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide valid startDate and endDate together.",
        });
      }
    }

    const pricing = await VillaRoomPricing.create({
      villaId,
      roomId,
      pricePerNight,
      maxGuests,
      adults,
      children,
      extraGuestPrice,
      startDate: parsedStart,
      endDate: parsedEnd,
    });

    return res.status(201).json({
      success: true,
      message: "Room pricing created successfully.",
      pricing,
    });
  } catch (error) {
    console.error("createPricing:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create room pricing.",
    });
  }
};

// UPDATE pricing rule
exports.updatePricing = async (req, res) => {
  try {
    const { villaId, roomId, pricingId } = req.params;

    if (
      !validId(villaId) ||
      !validId(roomId) ||
      !validId(pricingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid villa, room, or pricing ID.",
      });
    }

    const allowed = [
      "pricePerNight",
      "maxGuests",
      "adults",
      "children",
      "extraGuestPrice",
      "startDate",
      "endDate",
      "isActive",
    ];

    const updates = {};

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if ("startDate" in updates) {
      updates.startDate = updates.startDate
        ? parseDate(updates.startDate)
        : null;
    }

    if ("endDate" in updates) {
      updates.endDate = updates.endDate
        ? parseDate(updates.endDate)
        : null;
    }

    if (
      ("startDate" in updates && req.body.startDate && !updates.startDate) ||
      ("endDate" in updates && req.body.endDate && !updates.endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD.",
      });
    }

    const current = await VillaRoomPricing.findOne({
      _id: pricingId,
      villaId,
      roomId,
    });

    if (!current) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found.",
      });
    }

    const merged = { ...current.toObject(), ...updates };

    if (
      !Number.isFinite(merged.pricePerNight) ||
      merged.pricePerNight < 0 ||
      !Number.isInteger(merged.maxGuests) ||
      merged.maxGuests < 1 ||
      !Number.isInteger(merged.adults) ||
      merged.adults < 1 ||
      !Number.isInteger(merged.children) ||
      merged.children < 0 ||
      !Number.isFinite(merged.extraGuestPrice) ||
      merged.extraGuestPrice < 0 ||
      merged.adults + merged.children > merged.maxGuests ||
      (merged.startDate &&
        merged.endDate &&
        merged.startDate > merged.endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pricing or capacity values.",
      });
    }

    Object.assign(current, updates);
    await current.save();

    return res.json({
      success: true,
      message: "Room pricing updated successfully.",
      pricing: current,
    });
  } catch (error) {
    console.error("updatePricing:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room pricing.",
    });
  }
};

// DELETE pricing rule
exports.deletePricing = async (req, res) => {
  try {
    const { villaId, roomId, pricingId } = req.params;

    if (
      !validId(villaId) ||
      !validId(roomId) ||
      !validId(pricingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid IDs.",
      });
    }

    const deleted = await VillaRoomPricing.findOneAndDelete({
      _id: pricingId,
      villaId,
      roomId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found.",
      });
    }

    return res.json({
      success: true,
      message: "Room pricing deleted successfully.",
    });
  } catch (error) {
    console.error("deletePricing:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete room pricing.",
    });
  }
};
