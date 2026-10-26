const mongoose = require("mongoose");

/* ============================================================
   HOTEL ROOM MODEL
   MakeMyTrip-style Vendor Hotel Room Management
============================================================ */

const hotelRoomSchema = new mongoose.Schema(
  {
    /* ==========================================================
       REFERENCES
    ========================================================== */

    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    /* ==========================================================
       BASIC ROOM INFORMATION
    ========================================================== */

    roomName: { type: String, required: true, trim: true },

    roomType: {
      type: String,
      required: true,
      enum: [
        "standard",
        "deluxe",
        "super-deluxe",
        "premium",
        "executive",
        "suite",
        "junior-suite",
        "presidential-suite",
        "family-room",
        "studio",
        "villa",
        "dormitory",
        "other",
      ],
      default: "standard",
    },

    description: { type: String, default: "", trim: true },

    shortDescription: { type: String, default: "", trim: true, maxlength: 500 },

    floorNumber: { type: String, default: "" },

    roomSize: { type: Number, default: 0 },

    roomSizeUnit: { type: String, enum: ["sqft", "sqm"], default: "sqft" },

    viewType: {
      type: String,
      enum: [
        "city-view",
        "garden-view",
        "pool-view",
        "mountain-view",
        "sea-view",
        "lake-view",
        "courtyard-view",
        "no-view",
        "other",
      ],
      default: "no-view",
    },

    /* ==========================================================
       ROOM INVENTORY
    ========================================================== */

    totalRooms: { type: Number, required: true, min: 1 },
    availableRooms: { type: Number, default: 0, min: 0 },
    bookedRooms: { type: Number, default: 0, min: 0 },
    blockedRooms: { type: Number, default: 0, min: 0 },

    /* ==========================================================
       GUEST OCCUPANCY
    ========================================================== */

    maxGuests: { type: Number, required: true, min: 1 },
    maxAdults: { type: Number, default: 2, min: 1 },
    maxChildren: { type: Number, default: 0, min: 0 },
    extraGuestAllowed: { type: Boolean, default: false },
    extraGuestCharge: { type: Number, default: 0, min: 0 },

    /* ==========================================================
       BED CONFIGURATION
    ========================================================== */

    bedType: {
      type: String,
      enum: [
        "single",
        "twin",
        "double",
        "queen",
        "king",
        "super-king",
        "bunk",
        "sofa-bed",
        "multiple",
        "other",
      ],
      default: "double",
    },

    bedCount: { type: Number, default: 1, min: 1 },
    extraBedAvailable: { type: Boolean, default: false },
    extraBedCharge: { type: Number, default: 0, min: 0 },

    /* ==========================================================
       ROOM AMENITIES
    ========================================================== */

    amenities: { type: [String], default: [] },

    wifi: { type: Boolean, default: false },
    airConditioning: { type: Boolean, default: false },
    heater: { type: Boolean, default: false },
    television: { type: Boolean, default: false },
    smartTv: { type: Boolean, default: false },
    minibar: { type: Boolean, default: false },
    refrigerator: { type: Boolean, default: false },
    wardrobe: { type: Boolean, default: false },
    workDesk: { type: Boolean, default: false },
    sofa: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false },
    terrace: { type: Boolean, default: false },
    kitchen: { type: Boolean, default: false },
    kitchenette: { type: Boolean, default: false },
    washingMachine: { type: Boolean, default: false },
    iron: { type: Boolean, default: false },
    roomService: { type: Boolean, default: false },

    /* ==========================================================
       BATHROOM
    ========================================================== */

    bathroomCount: { type: Number, default: 1, min: 1 },

    bathroomType: {
      type: String,
      enum: ["private", "shared", "attached"],
      default: "private",
    },

    bathtub: { type: Boolean, default: false },
    shower: { type: Boolean, default: true },
    hotWater: { type: Boolean, default: true },
    toiletries: { type: Boolean, default: false },
    hairDryer: { type: Boolean, default: false },

    /* ==========================================================
       MEAL PLAN
    ========================================================== */

    mealPlan: {
      type: String,
      enum: [
        "room-only",
        "breakfast",
        "breakfast-lunch",
        "breakfast-dinner",
        "half-board",
        "full-board",
        "all-meals",
      ],
      default: "room-only",
    },

    breakfastIncluded: { type: Boolean, default: false },
    lunchIncluded: { type: Boolean, default: false },
    dinnerIncluded: { type: Boolean, default: false },
    mealPrice: { type: Number, default: 0, min: 0 },

    /* ==========================================================
       PRICING
    ========================================================== */

    basePrice: { type: Number, required: true, min: 0 },
    weekendPrice: { type: Number, default: 0, min: 0 },
    holidayPrice: { type: Number, default: 0, min: 0 },
    offerPrice: { type: Number, default: 0, min: 0 },
    taxPercentage: { type: Number, default: 0, min: 0, max: 100 },
    serviceChargePercentage: { type: Number, default: 0, min: 0, max: 100 },

    pricingMode: {
      type: String,
      enum: ["PER_NIGHT", "PER_ROOM"],
      default: "PER_NIGHT",
    },

    /* ==========================================================
       CANCELLATION / BOOKING POLICY
    ========================================================== */

    refundable: { type: Boolean, default: true },
    freeCancellation: { type: Boolean, default: false },
    cancellationDeadlineHours: { type: Number, default: 24, min: 0 },
    cancellationPolicy: { type: String, default: "" },
    instantBooking: { type: Boolean, default: true },
    bookingConfirmationRequired: { type: Boolean, default: false },
    minimumStay: { type: Number, default: 1, min: 1 },
    maximumStay: { type: Number, default: 30, min: 1 },

    /* ==========================================================
       GUEST POLICIES
    ========================================================== */

    coupleFriendly: { type: Boolean, default: true },
    unmarriedCouplesAllowed: { type: Boolean, default: true },
    localIdAllowed: { type: Boolean, default: true },
    childrenAllowed: { type: Boolean, default: true },
    petsAllowed: { type: Boolean, default: false },
    smokingAllowed: { type: Boolean, default: false },
    alcoholAllowed: { type: Boolean, default: false },
    partiesAllowed: { type: Boolean, default: false },
    eventsAllowed: { type: Boolean, default: false },

    houseRules: { type: [String], default: [] },

    /* ==========================================================
       MEDIA
    ========================================================== */

    coverImage: { type: String, default: "" },
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },

    /* ==========================================================
       STATUS
    ========================================================== */

    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "ACTIVE", "INACTIVE"],
      default: "DRAFT",
      index: true,
    },

    rejectionReason: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

/* ============================================================
   INDEXES
   (hotel / vendor / status par field-level index already hai,
    isliye yahan sirf compound indexes rakhe hain)
============================================================ */

hotelRoomSchema.index({ hotel: 1, vendor: 1 });
hotelRoomSchema.index({ hotel: 1, status: 1 });
hotelRoomSchema.index({ hotel: 1, roomType: 1 });
hotelRoomSchema.index({ vendor: 1, isActive: 1 });

/* ============================================================
   PRE SAVE
   NOTE: Naye Mongoose (v8/v9) me sync hook ko `next` nahi milta.
   Isliye function bina next ke likha hai - ye sab versions me chalta hai.
============================================================ */

hotelRoomSchema.pre("save", function () {
  // Naya room: available rooms auto calculate
  if (this.isNew && !this.availableRooms) {
    this.availableRooms = Math.max(
      this.totalRooms - this.bookedRooms - this.blockedRooms,
      0
    );
  }

  // Available rooms kabhi total se zyada na ho
  if (this.availableRooms > this.totalRooms) {
    this.availableRooms = this.totalRooms;
  }
});

/* ============================================================
   EXPORT
============================================================ */

module.exports = mongoose.models.HotelRoom ||
  mongoose.model("HotelRoom", hotelRoomSchema);