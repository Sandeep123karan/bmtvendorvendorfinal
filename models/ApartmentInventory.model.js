const mongoose = require("mongoose");

/*
  Ek document = ek apartment ka ek din (date-wise inventory).
  available = totalUnits - bookedUnits - blockedUnits
*/
const inventorySchema = new mongoose.Schema(
  {
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorApartment", // NOTE: Apartment.model.js me model name "VendorApartment" hai
      required: true,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    // Din ki starting 00:00 UTC
    date: { type: Date, required: true },

    totalUnits: { type: Number, required: true, min: 0, default: 1 },
    bookedUnits: { type: Number, default: 0, min: 0 }, // sirf booking module badhayega
    blockedUnits: { type: Number, default: 0, min: 0 }, // vendor ne band kiye

    price: { type: Number, default: null, min: 0 }, // null = apartment ka basePrice
    minNights: { type: Number, default: 1, min: 1 },
    stopSell: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Ek apartment + ek date ka sirf ek record
inventorySchema.index({ apartment: 1, date: 1 }, { unique: true });

inventorySchema.virtual("available").get(function () {
  return Math.max(0, this.totalUnits - this.bookedUnits - this.blockedUnits);
});

/*
  BOOKING MODULE KE LIYE (atomic, overbooking nahi hogi)
  const ok = await Inventory.reserve(apartmentId, arrayOfDates, 1);
  if (!ok) -> "Dates available nahi hain"
*/
inventorySchema.statics.reserve = async function (apartmentId, dates, units = 1) {
  const done = [];
  for (const date of dates) {
    const r = await this.updateOne(
      {
        apartment: apartmentId,
        date,
        stopSell: false,
        $expr: {
          $gte: [
            { $subtract: [{ $subtract: ["$totalUnits", "$bookedUnits"] }, "$blockedUnits"] },
            units,
          ],
        },
      },
      { $inc: { bookedUnits: units } }
    );
    if (!r.modifiedCount) {
      // rollback
      await Promise.all(
        done.map((d) =>
          this.updateOne({ apartment: apartmentId, date: d }, { $inc: { bookedUnits: -units } })
        )
      );
      return false;
    }
    done.push(date);
  }
  return true;
};

// Cancel hone par
inventorySchema.statics.release = function (apartmentId, dates, units = 1) {
  return this.updateMany(
    { apartment: apartmentId, date: { $in: dates }, bookedUnits: { $gte: units } },
    { $inc: { bookedUnits: -units } }
  );
};

inventorySchema.set("toJSON", { virtuals: true });
inventorySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("ApartmentInventory", inventorySchema);