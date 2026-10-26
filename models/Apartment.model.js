const mongoose = require("mongoose");


const apartmentSchema = new mongoose.Schema(
  {
    // =====================================================
    // VENDOR / OWNER
    // JWT se automatically aayega
    // =====================================================

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },


    // =====================================================
    // PROPERTY BASIC INFORMATION
    // =====================================================

    apartmentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    propertyType: {
      type: String,
      enum: [
        "Apartment",
        "Serviced Apartment",
        "Holiday Apartment",
        "Luxury Apartment",
        "Studio Apartment",
        "Vacation Rental",
        "Other",
      ],
      default: "Apartment",
    },

    description: {
      type: String,
      default: "",
      maxlength: 5000,
    },

    shortDescription: {
      type: String,
      default: "",
      maxlength: 300,
    },

    hostName: {
      type: String,
      default: "",
      trim: true,
    },


    // =====================================================
    // CONTACT
    // =====================================================

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    altPhone: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },


    // =====================================================
    // LOCATION
    // =====================================================

    country: {
      type: String,
      default: "India",
      trim: true,
    },

    state: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    area: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
    },

    pincode: {
      type: String,
      default: "",
      trim: true,
    },

    landmark: {
      type: String,
      default: "",
    },

    mapLocation: {
      lat: {
        type: Number,
        default: null,
      },

      lng: {
        type: Number,
        default: null,
      },
    },


    // =====================================================
    // BUILDING DETAILS
    // =====================================================

    buildingName: {
      type: String,
      default: "",
    },

    towerName: {
      type: String,
      default: "",
    },

    floorNumber: {
      type: Number,
      default: null,
    },

    totalFloors: {
      type: Number,
      default: null,
    },

    flatNumber: {
      type: String,
      default: "",
    },

    societyName: {
      type: String,
      default: "",
    },


    // =====================================================
    // APARTMENT CONFIGURATION
    // =====================================================

    apartmentType: {
      type: String,
      enum: [
        "Studio",
        "1BHK",
        "2BHK",
        "3BHK",
        "4BHK",
        "5BHK",
        "Penthouse",
        "Villa Apartment",
      ],
      default: "1BHK",
    },

    furnishing: {
      type: String,
      enum: [
        "Fully Furnished",
        "Semi Furnished",
        "Unfurnished",
      ],
      default: "Fully Furnished",
    },

    carpetArea: {
      type: Number,
      default: null,
    },

    superArea: {
      type: Number,
      default: null,
    },

    areaUnit: {
      type: String,
      enum: ["sqft", "sqm"],
      default: "sqft",
    },

    bedrooms: {
      type: Number,
      default: 1,
      min: 0,
    },

    hall: {
      type: Number,
      default: 1,
      min: 0,
    },

    kitchen: {
      type: Number,
      default: 1,
      min: 0,
    },

    bathrooms: {
      type: Number,
      default: 1,
      min: 0,
    },

    balcony: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxGuests: {
      type: Number,
      required: true,
      default: 2,
      min: 1,
    },

    maxAdults: {
      type: Number,
      default: 2,
      min: 1,
    },

    maxChildren: {
      type: Number,
      default: 0,
      min: 0,
    },

    beds: {
      type: Number,
      default: 1,
      min: 1,
    },


    // =====================================================
    // BED CONFIGURATION
    // MakeMyTrip type detailed information
    // =====================================================

    bedConfiguration: [
      {
        roomName: {
          type: String,
          default: "",
        },

        bedType: {
          type: String,
          enum: [
            "Single",
            "Double",
            "Queen",
            "King",
            "Sofa Bed",
            "Bunk Bed",
            "Other",
          ],
          default: "Double",
        },

        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
      },
    ],


    // =====================================================
    // CAPACITY / EXTRA GUESTS
    // =====================================================

    extraMattressAllowed: {
      type: Boolean,
      default: false,
    },

    maxExtraMattress: {
      type: Number,
      default: 0,
    },

    childrenAllowed: {
      type: Boolean,
      default: false,
    },

    petsAllowed: {
      type: Boolean,
      default: false,
    },


    // =====================================================
    // CHECK-IN / CHECK-OUT
    // =====================================================

    checkInTime: {
      type: String,
      default: "14:00",
    },

    checkOutTime: {
      type: String,
      default: "11:00",
    },


    // =====================================================
    // AMENITIES
    // =====================================================

    amenities: {
      type: [String],
      default: [],
    },


    // =====================================================
    // FOOD / KITCHEN
    // =====================================================

    kitchenAvailable: {
      type: Boolean,
      default: false,
    },

    selfCookingAllowed: {
      type: Boolean,
      default: false,
    },

    vegFoodAvailable: {
      type: Boolean,
      default: false,
    },

    nonVegAllowed: {
      type: Boolean,
      default: false,
    },

    mealPlan: {
      type: String,
      enum: [
        "Room Only",
        "Breakfast",
        "Breakfast and Dinner",
        "All Meals",
        "Custom",
      ],
      default: "Room Only",
    },


    // =====================================================
    // PRICING
    // Base pricing only
    // Advanced date-wise pricing separate module mein hogi
    // =====================================================

    pricing: {
      basePrice: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },

      monthlyPrice: {
        type: Number,
        default: 0,
        min: 0,
      },

      weekendPrice: {
        type: Number,
        default: 0,
        min: 0,
      },

      extraGuestPrice: {
        type: Number,
        default: 0,
        min: 0,
      },

      extraMattressPrice: {
        type: Number,
        default: 0,
        min: 0,
      },

      cleaningFee: {
        type: Number,
        default: 0,
        min: 0,
      },

      securityDeposit: {
        type: Number,
        default: 0,
        min: 0,
      },

      currency: {
        type: String,
        default: "INR",
      },
    },


    // =====================================================
    // INVENTORY TYPE
    // =====================================================

    roomType: {
      type: String,
      enum: [
        "Entire Apartment",
        "Private Room",
        "Shared Room",
      ],
      default: "Entire Apartment",
    },

    totalUnits: {
      type: Number,
      default: 1,
      min: 1,
    },


    // =====================================================
    // GENERAL AVAILABILITY
    // Date-wise inventory alag model mein banega
    // =====================================================

    availableFrom: {
      type: Date,
      default: null,
    },

    availableTo: {
      type: Date,
      default: null,
    },


    // =====================================================
    // HOUSE RULES
    // =====================================================

    houseRules: {
      smoking: {
        type: Boolean,
        default: false,
      },

      alcohol: {
        type: Boolean,
        default: false,
      },

      parties: {
        type: Boolean,
        default: false,
      },

      loudMusic: {
        type: Boolean,
        default: false,
      },

      unmarriedCouples: {
        type: Boolean,
        default: false,
      },

      localIdAllowed: {
        type: Boolean,
        default: false,
      },

      visitorsAllowed: {
        type: Boolean,
        default: false,
      },
    },

    cancellationPolicy: {
      type: String,
      default: "",
    },


    // =====================================================
    // MEDIA
    // =====================================================

    thumbnail: {
      type: String,
      default: "",
    },

    images: {
      type: [String],
      default: [],
    },


    // =====================================================
    // APPROVAL / LISTING STATUS
    // =====================================================

    // status: {
    //   type: String,
    //   enum: [
    //     "draft",
    //     "pending",
    //     "approved",
    //     "rejected",
    //     "inactive",
    //   ],
    //   default: "pending",
    //   index: true,
    // },

    // rejectionReason: {
    //   type: String,
    //   default: "",
    // },

    // approvedBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Admin",
    //   default: null,
    // },

    // approvedAt: {
    //   type: Date,
    //   default: null,
    // },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    // =====================================================
    // META
    // =====================================================

    notes: {
      type: String,
      default: "",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


// =====================================================
// INDEXES
// =====================================================

apartmentSchema.index({
  vendor: 1,
  createdAt: -1,
});

apartmentSchema.index({
  vendor: 1,
  status: 1,
});

apartmentSchema.index({
  city: 1,
  status: 1,
});


module.exports = mongoose.model(
  "VendorApartment",
  apartmentSchema
);