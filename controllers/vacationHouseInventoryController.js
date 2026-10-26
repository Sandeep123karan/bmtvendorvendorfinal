const mongoose = require("mongoose");
const VacationHouse = require("../models/vacationHouseModel");
const Inventory = require("../models/VacationHouseInventory");

const response = (res, status, message, data = null) =>
  res.status(status).json({
    success: status < 400,
    message,
    data,
  });

const validDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

const getOwnedHouse = async (houseId, vendorId) => {
  if (!mongoose.Types.ObjectId.isValid(houseId)) return null;

  return VacationHouse.findOne({
    _id: houseId,
    vendorId,
  });
};

// GET /:houseId?from=2026-10-27&to=2026-11-05
exports.getInventory = async (req, res) => {
  try {
    const house = await getOwnedHouse(
      req.params.houseId,
      req.vendor._id
    );

    if (!house) {
      return response(res, 404, "Vacation house not found");
    }

    const { from, to } = req.query;

    if (!validDate(from) || !validDate(to) || from > to) {
      return response(
        res,
        400,
        "Valid from and to dates are required (YYYY-MM-DD)"
      );
    }

    const inventory = await Inventory.find({
      houseId: house._id,
      vendorId: req.vendor._id,
      date: { $gte: from, $lte: to },
    }).sort({ date: 1 });

    return response(res, 200, "Inventory fetched successfully", {
      houseId: house._id,
      defaultUnits: 1,
      inventory: inventory.map((item) => ({
        ...item.toObject(),
        availableUnits:
          item.totalUnits - item.bookedUnits - item.blockedUnits,
      })),
    });
  } catch (error) {
    console.error("getInventory:", error);
    return response(res, 500, "Failed to fetch inventory");
  }
};

// PUT /:houseId/date/:date
// Body: { "totalUnits": 1, "priceOverride": 4500 }
exports.setInventory = async (req, res) => {
  try {
    const { houseId, date } = req.params;
    const { totalUnits, priceOverride } = req.body;

    if (!validDate(date)) {
      return response(res, 400, "Invalid date. Use YYYY-MM-DD");
    }

    const house = await getOwnedHouse(houseId, req.vendor._id);

    if (!house) {
      return response(res, 404, "Vacation house not found");
    }

    if (
      !Number.isInteger(totalUnits) ||
      totalUnits < 1 ||
      totalUnits > 1000
    ) {
      return response(
        res,
        400,
        "totalUnits must be an integer between 1 and 1000"
      );
    }

    if (
      priceOverride !== undefined &&
      priceOverride !== null &&
      (typeof priceOverride !== "number" ||
        !Number.isFinite(priceOverride) ||
        priceOverride < 0)
    ) {
      return response(
        res,
        400,
        "priceOverride must be a non-negative number or null"
      );
    }

    // Existing record ko read karke booked/blocked units preserve karo.
    const existing = await Inventory.findOne({
      houseId: house._id,
      vendorId: req.vendor._id,
      date,
    });

    const bookedUnits = existing?.bookedUnits || 0;
    const blockedUnits = existing?.blockedUnits || 0;

    if (totalUnits < bookedUnits + blockedUnits) {
      return response(
        res,
        400,
        "Total units cannot be less than booked plus blocked units"
      );
    }

    const update = { totalUnits };

    if (priceOverride !== undefined) {
      update.priceOverride = priceOverride;
    }

    const item = await Inventory.findOneAndUpdate(
      {
        houseId: house._id,
        vendorId: req.vendor._id,
        date,
      },
      {
        $set: update,
        $setOnInsert: {
          bookedUnits: 0,
          blockedUnits: 0,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    return response(res, 200, "Inventory saved successfully", {
      ...item.toObject(),
      availableUnits:
        item.totalUnits - item.bookedUnits - item.blockedUnits,
    });
  } catch (error) {
    console.error("setInventory:", error);

    if (error.code === 11000) {
      return response(
        res,
        409,
        "Inventory record already exists; please retry"
      );
    }

    return response(res, 500, "Failed to save inventory");
  }
};

// PATCH /:houseId/date/:date/block
// Body: { "blockedUnits": 1 }
exports.setBlockedUnits = async (req, res) => {
  try {
    const { houseId, date } = req.params;
    const { blockedUnits } = req.body;

    if (!validDate(date)) {
      return response(res, 400, "Invalid date. Use YYYY-MM-DD");
    }

    if (!Number.isInteger(blockedUnits) || blockedUnits < 0) {
      return response(
        res,
        400,
        "blockedUnits must be a non-negative integer"
      );
    }

    const house = await getOwnedHouse(houseId, req.vendor._id);

    if (!house) {
      return response(res, 404, "Vacation house not found");
    }

    const item = await Inventory.findOne({
      houseId: house._id,
      vendorId: req.vendor._id,
      date,
    });

    const totalUnits = item?.totalUnits ?? 1;
    const bookedUnits = item?.bookedUnits ?? 0;

    if (bookedUnits + blockedUnits > totalUnits) {
      return response(
        res,
        400,
        "Blocked plus booked units cannot exceed total units"
      );
    }

    // Agar inventory record nahi hai, default totalUnits = 1.
    const saved = await Inventory.findOneAndUpdate(
      {
        houseId: house._id,
        vendorId: req.vendor._id,
        date,
      },
      {
        $set: { blockedUnits },
        $setOnInsert: {
          totalUnits: 1,
          bookedUnits: 0,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    return response(res, 200, "Blocked units updated", {
      ...saved.toObject(),
      availableUnits:
        saved.totalUnits - saved.bookedUnits - saved.blockedUnits,
    });
  } catch (error) {
    console.error("setBlockedUnits:", error);
    return response(res, 500, "Failed to update blocked units");
  }
};

// DELETE /:houseId/date/:date
// Sirf tab delete hoga jab koi booking ya block na ho.
exports.deleteInventory = async (req, res) => {
  try {
    const { houseId, date } = req.params;

    if (!validDate(date)) {
      return response(res, 400, "Invalid date. Use YYYY-MM-DD");
    }

    const house = await getOwnedHouse(houseId, req.vendor._id);

    if (!house) {
      return response(res, 404, "Vacation house not found");
    }

    const item = await Inventory.findOne({
      houseId: house._id,
      vendorId: req.vendor._id,
      date,
    });

    if (!item) {
      return response(res, 404, "Inventory record not found");
    }

    if (item.bookedUnits > 0 || item.blockedUnits > 0) {
      return response(
        res,
        409,
        "Inventory cannot be deleted while units are booked or blocked"
      );
    }

    await item.deleteOne();

    return response(res, 200, "Inventory record deleted");
  } catch (error) {
    console.error("deleteInventory:", error);
    return response(res, 500, "Failed to delete inventory");
  }
};