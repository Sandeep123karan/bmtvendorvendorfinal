const mongoose = require("mongoose");

/*
===========================================================
 HOTEL INVENTORY
 One document = one room + one date  (date UTC midnight)
===========================================================
*/

const hotelInventorySchema = new mongoose.Schema(
  {
    /* REFERENCES */
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "HotelRoom", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },

    /* DATE */
    date: { type: Date, required: true },

    /* ROOM INVENTORY */
    totalRooms: { type: Number, required: true, min: 0 },
    availableRooms: { type: Number, default: 0, min: 0 },
    bookedRooms: { type: Number, default: 0, min: 0 },
    blockedRooms: { type: Number, default: 0, min: 0 },

    /* AVAILABILITY CONTROLS */
    stopSell: { type: Boolean, default: false },
    stopSellReason: { type: String, default: "", trim: true },
    isBlocked: { type: Boolean, default: false }, // poori date block
    blockReason: { type: String, default: "", trim: true },
    closedForBooking: { type: Boolean, default: false },

    /* PRICING */
    basePrice: { type: Number, required: true, min: 0 },
    offerPrice: { type: Number, default: 0, min: 0 }, // special price (sabse upar)
    weekendPrice: { type: Number, default: 0, min: 0 }, // Fri/Sat raat
    holidayPrice: { type: Number, default: 0, min: 0 },
    isHoliday: { type: Boolean, default: false },
    extraGuestCharge: { type: Number, default: 0, min: 0 },
    taxPercentage: { type: Number, default: 0, min: 0, max: 100 },
    serviceChargePercentage: { type: Number, default: 0, min: 0, max: 100 },

    /* MEAL PLAN */
    mealPlan: {
      type: String,
      enum: ["room-only", "breakfast", "breakfast-lunch", "breakfast-dinner", "half-board", "full-board", "all-meals"],
      default: "room-only",
    },
    breakfastIncluded: { type: Boolean, default: false },
    lunchIncluded: { type: Boolean, default: false },
    dinnerIncluded: { type: Boolean, default: false },

    /* BOOKING RULES */
    minimumStay: { type: Number, default: 1, min: 1 },
    maximumStay: { type: Number, default: 30, min: 1 },
    instantBooking: { type: Boolean, default: true },

    /* CANCELLATION */
    refundable: { type: Boolean, default: true },
    freeCancellation: { type: Boolean, default: false },
    cancellationDeadlineHours: { type: Number, default: 24, min: 0 },
    cancellationPolicy: { type: String, default: "" },

    /* STATUS (pre-save me flags se nikalta hai; booking code isi ko check karta hai) */
    status: { type: String, enum: ["OPEN", "CLOSED", "STOP_SELL"], default: "OPEN", index: true },
    isActive: { type: Boolean, default: true },

    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
  },
  { timestamps: true }
);

/* Ek room ki ek date par sirf ek inventory */
hotelInventorySchema.index({ room: 1, date: 1 }, { unique: true });
hotelInventorySchema.index({ hotel: 1, date: 1 });
hotelInventorySchema.index({ vendor: 1, date: 1 });
hotelInventorySchema.index({ room: 1, date: 1, status: 1 });

/* PRE SAVE  (Mongoose 9: hook ko `next` nahi milta) */
hotelInventorySchema.pre("save", function () {
  const occupied = Number(this.bookedRooms || 0) + Number(this.blockedRooms || 0);
  this.availableRooms = Math.max(Number(this.totalRooms || 0) - occupied, 0);

  if (!this.isBlocked) this.blockReason = "";

  if (this.stopSell) this.status = "STOP_SELL";
  else if (this.isBlocked || this.closedForBooking) this.status = "CLOSED";
  else this.status = "OPEN";
});

module.exports =
  mongoose.models.HotelInventory ||
  mongoose.model("HotelInventory", hotelInventorySchema);