// const mongoose = require("mongoose");

// // ==========================================
// // IMAGE SCHEMA — CLOUDINARY
// // ==========================================
// const imageSchema = new mongoose.Schema(
//   {
//     url: {
//       type: String,
//       required: [true, "Image URL is required"],
//       trim: true,
//     },

//     publicId: {
//       type: String,
//       default: "",
//       trim: true,
//     },
//   },
//   { _id: false }
// );

// // ==========================================
// // REUSABLE VALIDATORS
// // ==========================================
// const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// const palaceSchema = new mongoose.Schema(
//   {
//     // ==========================================
//     // VENDOR OWNER
//     // Vendor ID authenticated token se aayegi
//     // ==========================================
//     vendor: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Vendor",
//       required: [true, "Vendor is required"],
//     },

//     // ==========================================
//     // BASIC PROPERTY INFORMATION
//     // ==========================================
//     propertyName: {
//       type: String,
//       required: [true, "Property name is required"],
//       trim: true,
//       minlength: [2, "Property name must be at least 2 characters"],
//       maxlength: [150, "Property name cannot exceed 150 characters"],
//     },

//     propertyType: {
//       type: String,
//       enum: [
//         "heritage-palace",
//         "luxury-palace",
//         "royal-palace",
//         "heritage-hotel",
//         "fort-palace",
//         "other",
//       ],
//       default: "heritage-palace",
//     },

//     shortDescription: {
//       type: String,
//       trim: true,
//       default: "",
//       maxlength: [300, "Short description cannot exceed 300 characters"],
//     },

//     description: {
//       type: String,
//       trim: true,
//       default: "",
//       maxlength: [10000, "Description cannot exceed 10000 characters"],
//     },

//     starRating: {
//       type: Number,
//       min: [1, "Star rating must be at least 1"],
//       max: [5, "Star rating cannot exceed 5"],
//       default: 3,
//     },

//     // ==========================================
//     // CONTACT INFORMATION
//     // ==========================================
//     contact: {
//       phone: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 20,
//       },

//       alternatePhone: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 20,
//       },

//       email: {
//         type: String,
//         trim: true,
//         lowercase: true,
//         default: "",
//         maxlength: 254,
//         validate: {
//           validator: function (value) {
//             return (
//               !value ||
//               /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
//             );
//           },
//           message: "Please provide a valid contact email",
//         },
//       },
//     },

//     // ==========================================
//     // PROPERTY LOCATION
//     // ==========================================
//     address: {
//       addressLine: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 300,
//       },

//       landmark: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 200,
//       },

//       city: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 100,
//       },

//       state: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 100,
//       },

//       country: {
//         type: String,
//         trim: true,
//         default: "India",
//         maxlength: 100,
//       },

//       pincode: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 15,
//       },

//       latitude: {
//         type: Number,
//         default: null,
//         min: [-90, "Latitude cannot be less than -90"],
//         max: [90, "Latitude cannot exceed 90"],
//       },

//       longitude: {
//         type: Number,
//         default: null,
//         min: [-180, "Longitude cannot be less than -180"],
//         max: [180, "Longitude cannot exceed 180"],
//       },
//     },

//     // ==========================================
//     // PROPERTY DETAILS
//     // ==========================================
//     totalRooms: {
//       type: Number,
//       default: 0,
//       min: [0, "Total rooms cannot be negative"],
//       validate: {
//         validator: Number.isInteger,
//         message: "Total rooms must be a whole number",
//       },
//     },

//     heritageCertified: {
//       type: Boolean,
//       default: false,
//     },

//     weddingAllowed: {
//       type: Boolean,
//       default: false,
//     },

//     eventAllowed: {
//       type: Boolean,
//       default: false,
//     },

//     // ==========================================
//     // CHECK-IN / CHECK-OUT
//     // Format: HH:mm (24-hour format)
//     // ==========================================
//     checkInTime: {
//       type: String,
//       trim: true,
//       default: "14:00",
//       validate: {
//         validator: (value) => timeRegex.test(value),
//         message: "Check-in time must use HH:mm format",
//       },
//     },

//     checkOutTime: {
//       type: String,
//       trim: true,
//       default: "11:00",
//       validate: {
//         validator: (value) => timeRegex.test(value),
//         message: "Check-out time must use HH:mm format",
//       },
//     },

//     // ==========================================
//     // AMENITIES
//     // Example: ["WiFi", "Swimming Pool", "Restaurant"]
//     // ==========================================
//     amenities: {
//       type: [
//         {
//           type: String,
//           trim: true,
//           maxlength: 100,
//         },
//       ],
//       default: [],
//       validate: {
//         validator: function (values) {
//           if (!Array.isArray(values)) return false;

//           const normalized = values
//             .filter((value) => value.trim())
//             .map((value) => value.toLowerCase());

//           return (
//             values.every((value) => value.trim().length > 0) &&
//             normalized.length === new Set(normalized).size
//           );
//         },
//         message: "Amenities cannot be empty or duplicated",
//       },
//     },

//     // ==========================================
//     // PROPERTY GALLERY — CLOUDINARY
//     // ==========================================
//     images: {
//       type: [imageSchema],
//       default: [],
//       validate: {
//         validator: (images) => images.length <= 30,
//         message: "A maximum of 30 property images is allowed",
//       },
//     },

//     // ==========================================
//     // COVER IMAGE
//     // URL and publicId should match a gallery image
//     // when set by the controller.
//     // ==========================================
//     coverImage: {
//       url: {
//         type: String,
//         trim: true,
//         default: "",
//       },

//       publicId: {
//         type: String,
//         trim: true,
//         default: "",
//       },
//     },

//     // ==========================================
//     // PROPERTY POLICIES
//     // ==========================================
//     policies: {
//       cancellationPolicy: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 3000,
//       },

//       childPolicy: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 3000,
//       },

//       petPolicy: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 3000,
//       },

//       smokingPolicy: {
//         type: String,
//         trim: true,
//         default: "",
//         maxlength: 3000,
//       },

//       unmarriedCouplesAllowed: {
//         type: Boolean,
//         default: false,
//       },

//       localIdAllowed: {
//         type: Boolean,
//         default: false,
//       },

//       idProofRequired: {
//         type: Boolean,
//         default: true,
//       },
//     },

//     // ==========================================
//     // ADMIN APPROVAL
//     // Vendor API should not freely set these fields.
//     // ==========================================
//     status: {
//       type: String,
//       enum: [
//         "DRAFT",
//         "PENDING",
//         "APPROVED",
//         "REJECTED",
//         "INACTIVE",
//       ],
//       default: "DRAFT",
//     },

//     rejectionReason: {
//       type: String,
//       trim: true,
//       default: "",
//       maxlength: 1000,
//     },

//     isActive: {
//       type: Boolean,
//       default: true,
//     },

//     isFeatured: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//     versionKey: false,
//   }
// );

// // ==========================================
// // INDEXES
// // ==========================================

// // Vendor-wise palace listing, newest first
// palaceSchema.index({ vendor: 1, createdAt: -1 });

// // Public listing and admin filtering
// palaceSchema.index({ status: 1, isActive: 1 });

// // Location-based filtering
// palaceSchema.index({ "address.city": 1, "address.state": 1 });

// // ==========================================
// // MODEL EXPORT
// // ==========================================
// module.exports =
//   mongoose.models.Palace ||
//   mongoose.model("Palace", palaceSchema);

const mongoose = require("mongoose");

// ==========================================
// IMAGE SCHEMA — CLOUDINARY
// ==========================================
const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "Image URL is required"],
      trim: true,
    },

    publicId: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

// ==========================================
// REUSABLE VALIDATORS
// ==========================================
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const palaceSchema = new mongoose.Schema(
  {
    // ==========================================
    // VENDOR OWNER
    // Vendor ID authenticated token se aayegi
    // ==========================================
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
    },

    // ==========================================
    // BASIC PROPERTY INFORMATION
    // ==========================================
    propertyName: {
      type: String,
      required: [true, "Property name is required"],
      trim: true,
      minlength: [2, "Property name must be at least 2 characters"],
      maxlength: [150, "Property name cannot exceed 150 characters"],
    },

    propertyType: {
      type: String,
      enum: [
        "heritage-palace",
        "luxury-palace",
        "royal-palace",
        "heritage-hotel",
        "fort-palace",
        "other",
      ],
      default: "heritage-palace",
    },

    shortDescription: {
      type: String,
      trim: true,
      default: "",
      maxlength: [300, "Short description cannot exceed 300 characters"],
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [10000, "Description cannot exceed 10000 characters"],
    },

    starRating: {
      type: Number,
      min: [1, "Star rating must be at least 1"],
      max: [5, "Star rating cannot exceed 5"],
      default: 3,
    },

    // ==========================================
    // CONTACT INFORMATION
    // ==========================================
    contact: {
      phone: {
        type: String,
        trim: true,
        default: "",
        maxlength: 20,
      },

      alternatePhone: {
        type: String,
        trim: true,
        default: "",
        maxlength: 20,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
        maxlength: 254,
        validate: {
          validator: function (value) {
            return (
              !value ||
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            );
          },
          message: "Please provide a valid contact email",
        },
      },
    },

    // ==========================================
    // PROPERTY LOCATION
    // ==========================================
    address: {
      addressLine: {
        type: String,
        trim: true,
        default: "",
        maxlength: 300,
      },

      landmark: {
        type: String,
        trim: true,
        default: "",
        maxlength: 200,
      },

      city: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      state: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      country: {
        type: String,
        trim: true,
        default: "India",
        maxlength: 100,
      },

      pincode: {
        type: String,
        trim: true,
        default: "",
        maxlength: 15,
      },

      latitude: {
        type: Number,
        default: null,
        min: [-90, "Latitude cannot be less than -90"],
        max: [90, "Latitude cannot exceed 90"],
      },

      longitude: {
        type: Number,
        default: null,
        min: [-180, "Longitude cannot be less than -180"],
        max: [180, "Longitude cannot exceed 180"],
      },
    },

    // ==========================================
    // PROPERTY DETAILS
    // ==========================================
    totalRooms: {
      type: Number,
      default: 0,
      min: [0, "Total rooms cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Total rooms must be a whole number",
      },
    },

    heritageCertified: {
      type: Boolean,
      default: false,
    },

    weddingAllowed: {
      type: Boolean,
      default: false,
    },

    eventAllowed: {
      type: Boolean,
      default: false,
    },

    // ==========================================
    // CHECK-IN / CHECK-OUT
    // Format: HH:mm (24-hour format)
    // ==========================================
    checkInTime: {
      type: String,
      trim: true,
      default: "14:00",
      validate: {
        validator: (value) => timeRegex.test(value),
        message: "Check-in time must use HH:mm format",
      },
    },

    checkOutTime: {
      type: String,
      trim: true,
      default: "11:00",
      validate: {
        validator: (value) => timeRegex.test(value),
        message: "Check-out time must use HH:mm format",
      },
    },

    // ==========================================
    // AMENITIES
    // Example: ["WiFi", "Swimming Pool", "Restaurant"]
    // ==========================================
    amenities: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 100,
        },
      ],
      default: [],
      validate: {
        validator: function (values) {
          if (!Array.isArray(values)) return false;

          const normalized = values
            .filter((value) => value.trim())
            .map((value) => value.toLowerCase());

          return (
            values.every((value) => value.trim().length > 0) &&
            normalized.length === new Set(normalized).size
          );
        },
        message: "Amenities cannot be empty or duplicated",
      },
    },

    // ==========================================
    // PROPERTY GALLERY — CLOUDINARY
    // ==========================================
    images: {
      type: [imageSchema],
      default: [],
      validate: {
        validator: (images) => images.length <= 30,
        message: "A maximum of 30 property images is allowed",
      },
    },

    // ==========================================
    // COVER IMAGE
    // URL and publicId should match a gallery image
    // when set by the controller.
    // ==========================================
    coverImage: {
      url: {
        type: String,
        trim: true,
        default: "",
      },

      publicId: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // ==========================================
    // PROPERTY POLICIES
    // ==========================================
    policies: {
      cancellationPolicy: {
        type: String,
        trim: true,
        default: "",
        maxlength: 3000,
      },

      childPolicy: {
        type: String,
        trim: true,
        default: "",
        maxlength: 3000,
      },

      petPolicy: {
        type: String,
        trim: true,
        default: "",
        maxlength: 3000,
      },

      smokingPolicy: {
        type: String,
        trim: true,
        default: "",
        maxlength: 3000,
      },

      unmarriedCouplesAllowed: {
        type: Boolean,
        default: false,
      },

      localIdAllowed: {
        type: Boolean,
        default: false,
      },

      idProofRequired: {
        type: Boolean,
        default: true,
      },
    },

    // ==========================================
    // STATUS
    // No admin approval needed: new palaces go
    // live immediately (APPROVED). Vendor can
    // switch APPROVED <-> INACTIVE with the toggle.
    // ==========================================
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "INACTIVE",
      ],
      default: "APPROVED",
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ==========================================
// INDEXES
// ==========================================

// Vendor-wise palace listing, newest first
palaceSchema.index({ vendor: 1, createdAt: -1 });

// Public listing and admin filtering
palaceSchema.index({ status: 1, isActive: 1 });

// Location-based filtering
palaceSchema.index({ "address.city": 1, "address.state": 1 });

// ==========================================
// MODEL EXPORT
// ==========================================
module.exports =
  mongoose.models.Palace ||
  mongoose.model("Palace", palaceSchema);