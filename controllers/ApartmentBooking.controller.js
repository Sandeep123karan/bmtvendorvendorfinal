const crypto = require("crypto");

const Apartment = require("../models/Apartment.model");

const ApartmentRatePlan = require(
  "../models/ApartmentRatePlan.model"
);

const ApartmentDynamicPricing = require(
  "../models/ApartmentDynamicPricing.model"
);

const ApartmentInventory = require(
  "../models/ApartmentInventory.model"
);

const ApartmentBooking = require(
  "../models/ApartmentBooking.model"
);


/* ==========================================
   HELPERS
========================================== */

const normalizeDate = (value) => {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);

  return date;
};


const generateBookingId = () => {
  const random = crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `APT-${Date.now()}-${random}`;
};


const getNights = (checkIn, checkOut) => {
  const oneDay = 1000 * 60 * 60 * 24;

  return Math.round(
    (checkOut.getTime() - checkIn.getTime()) /
      oneDay
  );
};


/* ==========================================
   GET PRICE FOR ONE DATE
========================================== */

const getPriceForDate = async (
  apartmentId,
  ratePlan,
  date
) => {
  const rule =
    await ApartmentDynamicPricing.findOne({
      apartment: apartmentId,
      ratePlan: ratePlan._id,

      isActive: true,

      startDate: { $lte: date },
      endDate: { $gte: date },
    })
      .sort({
        priority: -1,
        createdAt: -1,
      });


  // Stop sell
  if (rule?.stopSell) {
    return {
      stopSell: true,
    };
  }


  // Dynamic price
  if (rule) {
    return {
      stopSell: false,

      price: rule.price,

      dynamicPricingId: rule._id,
    };
  }


  // Weekend price
  const day = date.getDay();

  if (
    (day === 0 || day === 6) &&
    ratePlan.weekendPrice > 0
  ) {
    return {
      stopSell: false,

      price: ratePlan.weekendPrice,

      dynamicPricingId: null,
    };
  }


  // Base price
  return {
    stopSell: false,

    price: ratePlan.basePrice,

    dynamicPricingId: null,
  };
};


/* =====================================================
   CREATE BOOKING
===================================================== */

exports.createBooking = async (
  req,
  res
) => {
  try {
    const {
      apartmentId,
      ratePlanId,

      checkInDate,
      checkOutDate,

      adults = 1,
      children = 0,
      extraMattress = 0,

      guest,

      paymentMethod = "ONLINE",

      specialRequests,
    } = req.body;


    // ======================================
    // BASIC VALIDATION
    // ======================================

    if (
      !apartmentId ||
      !ratePlanId ||
      !checkInDate ||
      !checkOutDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Apartment, rate plan, check-in and check-out dates are required.",
      });
    }


    if (
      !guest?.firstName ||
      !guest?.phone
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Guest firstName and phone are required.",
      });
    }


    const checkIn =
      normalizeDate(checkInDate);

    const checkOut =
      normalizeDate(checkOutDate);


    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message:
          "Check-out date must be after check-in date.",
      });
    }


    const nights =
      getNights(checkIn, checkOut);


    // ======================================
    // APARTMENT
    // ======================================

    const apartment =
      await Apartment.findOne({
        _id: apartmentId,
        status: "approved",
        isDeleted: false,
      });


    if (!apartment) {
      return res.status(404).json({
        success: false,
        message:
          "Apartment is not available for booking.",
      });
    }


    // ======================================
    // RATE PLAN
    // ======================================

    const ratePlan =
      await ApartmentRatePlan.findOne({
        _id: ratePlanId,
        apartment: apartmentId,
        isActive: true,
      });


    if (!ratePlan) {
      return res.status(404).json({
        success: false,
        message:
          "Selected rate plan is not available.",
      });
    }


    // ======================================
    // STAY RULES
    // ======================================

    if (nights < ratePlan.minStay) {
      return res.status(400).json({
        success: false,
        message:
          `Minimum stay is ${ratePlan.minStay} night(s).`,
      });
    }


    if (nights > ratePlan.maxStay) {
      return res.status(400).json({
        success: false,
        message:
          `Maximum stay is ${ratePlan.maxStay} night(s).`,
      });
    }


    // ======================================
    // GUEST VALIDATION
    // ======================================

    if (Number(adults) > apartment.maxAdults) {
      return res.status(400).json({
        success: false,
        message:
          `Maximum ${apartment.maxAdults} adults allowed.`,
      });
    }


    if (
      Number(children) >
      apartment.maxChildren
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Maximum ${apartment.maxChildren} children allowed.`,
      });
    }


    if (
      Number(extraMattress) >
      apartment.maxExtraMattress
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Maximum ${apartment.maxExtraMattress} extra mattresses allowed.`,
      });
    }


    // ======================================
    // INVENTORY + PRICE CALCULATION
    // Check every night
    // Checkout date is NOT charged
    // ======================================

    let roomAmount = 0;

    const dateWisePricing = [];

    for (
      let current = new Date(checkIn);
      current < checkOut;
      current.setDate(
        current.getDate() + 1
      )
    ) {
      const date = new Date(current);


      // Inventory record
      const inventory =
        await ApartmentInventory.findOne({
          apartment: apartmentId,
          date,
        });


      // If record exists, check availability
      if (
        inventory &&
        (
          inventory.status === "BLOCKED" ||
          inventory.status === "SOLD_OUT" ||
          inventory.availableUnits < 1
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Apartment is not available on ${date.toISOString().split("T")[0]}`,
        });
      }


      // Dynamic / weekend / base pricing
      const priceResult =
        await getPriceForDate(
          apartmentId,
          ratePlan,
          date
        );


      if (priceResult.stopSell) {
        return res.status(400).json({
          success: false,
          message:
            `Booking is closed on ${date.toISOString().split("T")[0]}`,
        });
      }


      roomAmount +=
        Number(priceResult.price);


      dateWisePricing.push({
        date,

        price: Number(priceResult.price),

        ratePlanPrice:
          Number(ratePlan.basePrice),

        dynamicPricingId:
          priceResult.dynamicPricingId,
      });
    }


    // ======================================
    // EXTRA GUEST
    // Simple logic:
    // adults above maxAdults = charge
    // ======================================

   const extraAdults = Math.max(
  Number(adults) -
    Number(apartment.maxAdults || adults),
  0
);


    const extraGuestAmount =
      extraAdults *
      Number(ratePlan.extraAdultPrice || 0) *
      nights;


    const extraMattressAmount =
      Number(extraMattress) *
      Number(ratePlan.extraMattressPrice || 0) *
      nights;


    const cleaningFee =
      Number(
        apartment.pricing?.cleaningFee || 0
      );


    const securityDeposit =
      Number(
        apartment.pricing?.securityDeposit || 0
      );


    const taxableAmount =
      roomAmount +
      extraGuestAmount +
      extraMattressAmount +
      cleaningFee;


    const gstPercentage =
      Number(ratePlan.gstPercentage || 0);


    const gstAmount =
      (taxableAmount * gstPercentage) / 100;


    const totalAmount =
      taxableAmount +
      gstAmount +
      securityDeposit;


    // ======================================
    // CREATE BOOKING
    // ======================================

    const booking =
      await ApartmentBooking.create({
        bookingId:
          generateBookingId(),

        apartment: apartment._id,

        vendor: apartment.vendor,

        ratePlan: ratePlan._id,

        user: req.user?._id || null,

        guest: {
          firstName: guest.firstName,
          lastName:
            guest.lastName || "",

          email:
            guest.email || "",

          phone: guest.phone,
        },

        checkInDate: checkIn,
        checkOutDate: checkOut,

        nights,

        adults: Number(adults),
        children: Number(children),
        extraMattress:
          Number(extraMattress),

        dateWisePricing,

        pricing: {
          roomAmount,
          extraGuestAmount,
          extraMattressAmount,
          cleaningFee,
          securityDeposit,
          discount: 0,
          taxableAmount,
          gstPercentage,
          gstAmount,
          totalAmount,
          currency: "INR",
        },

        paymentMethod,

        specialRequests:
          specialRequests || "",

        bookingStatus: "PENDING",
        paymentStatus: "PENDING",
      });


    // ======================================
    // RESERVE INVENTORY
    // PENDING booking ke liye bhi reserve
    // Payment failure/cancel par release hoga
    // ======================================

    const inventoryOperations = [];

    for (
      let current = new Date(checkIn);
      current < checkOut;
      current.setDate(
        current.getDate() + 1
      )
    ) {
      const date = new Date(current);

      inventoryOperations.push({
        updateOne: {
          filter: {
            apartment: apartment._id,
            date,
          },

          update: {
            $setOnInsert: {
              apartment: apartment._id,
              vendor: apartment.vendor,
              date,
              totalUnits:
                apartment.totalUnits || 1,
              blockedUnits: 0,
            },

            $inc: {
              bookedUnits: 1,
              availableUnits: -1,
            },

            $set: {
              booking: booking._id,
            },
          },

          upsert: true,
        },
      });
    }


    await ApartmentInventory.bulkWrite(
      inventoryOperations
    );


    // Update status after increment
    await ApartmentInventory.updateMany(
      {
        apartment: apartment._id,
        date: {
          $gte: checkIn,
          $lt: checkOut,
        },
        availableUnits: { $lte: 0 },
      },
      {
        $set: {
          status: "SOLD_OUT",
          availableUnits: 0,
        },
      }
    );


    return res.status(201).json({
      success: true,
      message:
        "Apartment booking created successfully.",
      data: booking,
    });

  } catch (error) {
    console.error(
      "CREATE APARTMENT BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/* =====================================================
   GET VENDOR BOOKINGS
===================================================== */

exports.getVendorBookings = async (
  req,
  res
) => {
  try {
    const {
      status,
      apartmentId,
      page = 1,
      limit = 20,
    } = req.query;


    const filter = {
      vendor: req.vendor._id,
    };


    if (status) {
      filter.bookingStatus =
        status.toUpperCase();
    }


    if (apartmentId) {
      filter.apartment = apartmentId;
    }


    const skip =
      (Number(page) - 1) *
      Number(limit);


    const [
      bookings,
      total,
    ] = await Promise.all([
      ApartmentBooking.find(filter)
        .populate(
          "apartment",
          "apartmentName city thumbnail"
        )
        .populate(
          "ratePlan",
          "name code"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      ApartmentBooking.countDocuments(filter),
    ]);


    return res.status(200).json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(
        total / Number(limit)
      ),
      data: bookings,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/* =====================================================
   GET SINGLE VENDOR BOOKING
===================================================== */

exports.getBookingById = async (
  req,
  res
) => {
  try {
    const booking =
      await ApartmentBooking.findOne({
        _id: req.params.id,
        vendor: req.vendor._id,
      })
        .populate("apartment")
        .populate("ratePlan");


    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }


    return res.status(200).json({
      success: true,
      data: booking,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =====================================================
   UPDATE VENDOR BOOKING STATUS
   PATCH /api/apartment-bookings/vendor/:id/status
===================================================== */

exports.updateVendorBookingStatus = async (req, res) => {
  try {
    const vendorId = req.vendor?._id;

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication required.",
      });
    }

    const { status } = req.body;
    const allowedStatuses = [
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ];

    const nextStatus = String(status || "").toUpperCase();

    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status.",
        allowedStatuses,
      });
    }

    const booking = await ApartmentBooking.findOne({
      _id: req.params.id,
      vendor: vendorId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found for this vendor.",
      });
    }

    if (
      booking.bookingStatus === "CANCELLED" ||
      booking.bookingStatus === "COMPLETED"
    ) {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${booking.bookingStatus.toLowerCase()}.`,
      });
    }

    if (nextStatus === "COMPLETED") {
      if (new Date(booking.checkOutDate) > new Date()) {
        return res.status(400).json({
          success: false,
          message: "Booking cannot be completed before check-out.",
        });
      }

      booking.checkedOutAt = new Date();
    }

    if (nextStatus === "CANCELLED") {
      booking.cancelledBy = "VENDOR";
      booking.cancelledAt = new Date();
      booking.cancellationReason =
        req.body.reason || "Cancelled by vendor";
    }

    booking.bookingStatus = nextStatus;
    await booking.save();

    return res.status(200).json({
      success: true,
      message: `Booking status updated to ${nextStatus}.`,
      data: booking,
    });
  } catch (error) {
    console.error("UPDATE APARTMENT BOOKING STATUS:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update booking status.",
    });
  }
};
