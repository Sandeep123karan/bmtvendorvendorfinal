const mongoose = require("mongoose");
const { getDayType, round } = require("../utils/Homestayhelpers");


const num = (extra = {}) => ({ type: Number, default: 0, min: 0, ...extra });

const homestayInventorySchema = new mongoose.Schema(
  {
    homestay: { type: mongoose.Schema.Types.ObjectId, ref: "Homestay", required: true, index: true },
    // NOTE: ref name wahi hona chahiye jo Homestayroom.model.js me mongoose.model("...") me diya hai
    room: { type: mongoose.Schema.Types.ObjectId, ref: "HomestayRoom", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },

    date: { type: Date, required: true, index: true },

    /* units */
    totalUnits: { type: Number, required: true, min: 0 },
    availableUnits: num(),
    bookedUnits: num(),
    blockedUnits: num(),

    /* prices (vendor input) */
    basePrice: num(),
    weekendPrice: num(),
    holidayPrice: num(),
    specialPrice: num(),
    extraGuestPrice: num(),

    /* auto-calculated */
    appliedPrice: num(), // is date par lagne wali price (discount se pehle)
    finalPrice: num(), // discount ke baad, per night per unit

    discountType: { type: String, enum: ["none", "percentage", "flat"], default: "none" },
    discountValue: num(),

    taxPercentage: num({ max: 100 }),
    taxAmount: num(),
    serviceChargePercentage: num({ max: 100 }),
    serviceChargeAmount: num(),

    dayType: { type: String, enum: ["weekday", "weekend", "holiday"], default: "weekday" },
    isHoliday: { type: Boolean, default: false },

    /* availability */
    isAvailable: { type: Boolean, default: true, index: true },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: "", trim: true },
    stopSell: { type: Boolean, default: false },
    closedForBooking: { type: Boolean, default: false },

    /* stay rules */
    minimumStay: { type: Number, default: 1, min: 1 },
    maximumStay: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    checkInAllowed: { type: Boolean, default: true },
    checkOutAllowed: { type: Boolean, default: true },

    totalBookings: num(),

    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/* Ek room ki ek date ka sirf ek record */
homestayInventorySchema.index({ room: 1, date: 1 }, { unique: true });
homestayInventorySchema.index({ homestay: 1, date: 1 });
homestayInventorySchema.index({ vendor: 1, date: 1 });

/* Price + units + availability ek hi jagah calculate hote hain */
homestayInventorySchema.methods.recalculate = function () {
  this.dayType = this.isHoliday ? "holiday" : getDayType(this.date);

  let price = this.basePrice || 0;
  if (this.dayType === "weekend" && this.weekendPrice > 0) price = this.weekendPrice;
  if (this.dayType === "holiday" && this.holidayPrice > 0) price = this.holidayPrice;
  if (this.specialPrice > 0) price = this.specialPrice;
  this.appliedPrice = price;

  let discount = 0;
  if (this.discountType === "percentage") discount = (price * Math.min(this.discountValue, 100)) / 100;
  if (this.discountType === "flat") discount = Math.min(this.discountValue, price);

  this.finalPrice = round(Math.max(price - discount, 0));
  this.taxAmount = round((this.finalPrice * this.taxPercentage) / 100);
  this.serviceChargeAmount = round((this.finalPrice * this.serviceChargePercentage) / 100);

  this.availableUnits = Math.max(this.totalUnits - this.bookedUnits - this.blockedUnits, 0);
  this.isAvailable =
    this.availableUnits > 0 && !this.isBlocked && !this.stopSell && !this.closedForBooking;

  this.lastUpdatedAt = new Date();
};

// (purane code me `next` call hi nahi hota tha, isliye save() hang ho jata tha)
homestayInventorySchema.pre("save", function () {
  this.recalculate();
});

module.exports = mongoose.model("HomestayInventory", homestayInventorySchema);