// const mongoose = require("mongoose");

// const NightClubEvent = require(
//   "../models/NightClubEvent.model"
// );

// const NightClubEventTicket = require(
//   "../models/NightClubEventTicket.model"
// );

// const NightClubEventBooking = require(
//   "../models/NightClubEventBooking.model"
// );

// // =====================================================
// // GENERATE BOOKING ID
// // =====================================================

// const generateBookingId = () => {
//   const random = Math.random()
//     .toString(36)
//     .substring(2, 8)
//     .toUpperCase();

//   return `NC-${Date.now()}-${random}`;
// };

// // =====================================================
// // CREATE BOOKING
// // =====================================================

// exports.createNightClubEventBooking = async (
//   req,
//   res
// ) => {
//   try {
//     const userId = req.user?._id;

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User authentication required",
//       });
//     }

//     const {
//       eventId,
//       ticketId,
//       quantity,
//       customerName,
//       customerEmail,
//       customerPhone,
//     } = req.body;

//     // =====================================================
//     // VALIDATION
//     // =====================================================

//     if (
//       !eventId ||
//       !ticketId ||
//       !quantity ||
//       !customerName ||
//       !customerEmail ||
//       !customerPhone
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "eventId, ticketId, quantity, customerName, customerEmail and customerPhone are required",
//       });
//     }

//     if (
//       !mongoose.Types.ObjectId.isValid(eventId)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid eventId",
//       });
//     }

//     if (
//       !mongoose.Types.ObjectId.isValid(ticketId)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid ticketId",
//       });
//     }

//     const bookingQuantity = Number(quantity);

//     if (
//       !Number.isInteger(bookingQuantity) ||
//       bookingQuantity < 1
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Quantity must be a valid number greater than 0",
//       });
//     }

//     // =====================================================
//     // FIND EVENT
//     // =====================================================

//     const event = await NightClubEvent.findOne({
//       _id: eventId,
//       status: "published",
//       isPublished: true,
//     });

//     if (!event) {
//       return res.status(404).json({
//         success: false,
//         message:
//           "Event not found or not published",
//       });
//     }

//     // =====================================================
//     // EVENT DATE CHECK
//     // =====================================================

//     const now = new Date();

//     const eventDate = new Date(
//       event.eventDate
//     );

//     if (eventDate < now) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "This event has already started or ended",
//       });
//     }

//     // =====================================================
//     // FIND TICKET
//     // =====================================================

//     const ticket =
//       await NightClubEventTicket.findOne({
//         _id: ticketId,
//         eventId: event._id,
//         isActive: true,
//       });

//     if (!ticket) {
//       return res.status(404).json({
//         success: false,
//         message:
//           "Ticket not found or inactive",
//       });
//     }

//     // =====================================================
//     // TICKET SOLD OUT CHECK
//     // =====================================================

//     if (
//       ticket.isSoldOut ||
//       ticket.availableQuantity <= 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Tickets are sold out",
//       });
//     }

//     // =====================================================
//     // AVAILABLE QUANTITY
//     // =====================================================

//     if (
//       ticket.availableQuantity <
//       bookingQuantity
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Not enough tickets available",
//         availableQuantity:
//           ticket.availableQuantity,
//       });
//     }

//     // =====================================================
//     // SALE START
//     // =====================================================

//     if (
//       ticket.saleStartDate &&
//       now <
//         new Date(ticket.saleStartDate)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Ticket sale has not started yet",
//       });
//     }

//     // =====================================================
//     // SALE END
//     // =====================================================

//     if (
//       ticket.saleEndDate &&
//       now >
//         new Date(ticket.saleEndDate)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Ticket sale has ended",
//       });
//     }

//     // =====================================================
//     // TOTAL CALCULATION
//     // =====================================================

//     const pricePerTicket =
//       Number(ticket.price);

//     const totalAmount =
//       pricePerTicket *
//       bookingQuantity;

//     const personsPerTicket =
//       Number(
//         ticket.personsPerTicket || 1
//       );

//     const totalPersons =
//       bookingQuantity *
//       personsPerTicket;

//     // =====================================================
//     // CHECK EVENT CAPACITY
//     // =====================================================

//     if (
//       typeof event.availableCapacity ===
//         "number" &&
//       event.availableCapacity <
//         totalPersons
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Not enough event capacity available",
//         availableCapacity:
//           event.availableCapacity,
//       });
//     }

//     // =====================================================
//     // PAYMENT EXPIRY
//     // 15 MINUTES
//     // =====================================================

//     const paymentExpiresAt =
//       new Date(
//         Date.now() +
//           15 * 60 * 1000
//       );

//     // =====================================================
//     // CREATE BOOKING
//     // =====================================================

//     const booking =
//       await NightClubEventBooking.create({
//         userId,

//         customerName:
//           customerName.trim(),

//         customerEmail:
//           customerEmail
//             .toLowerCase()
//             .trim(),

//         customerPhone:
//           customerPhone.trim(),

//         vendorId:
//           event.vendorId,

//         nightClubId:
//           event.nightClubId,

//         eventId:
//           event._id,

//         ticketId:
//           ticket._id,

//         ticketName:
//           ticket.name,

//         ticketType:
//           ticket.ticketType,

//         quantity:
//           bookingQuantity,

//         personsPerTicket,

//         totalPersons,

//         pricePerTicket,

//         totalAmount,

//         currency:
//           ticket.currency || "INR",

//         bookingId:
//           generateBookingId(),

//         bookingStatus:
//           "pending",

//         paymentStatus:
//           "pending",

//         paymentMethod:
//           "razorpay",

//         paymentExpiresAt,
//       });

//     // =====================================================
//     // IMPORTANT
//     //
//     // YAHAN TICKET QUANTITY DEDUCT NAHI KAR RAHE.
//     //
//     // Payment successful hone ke baad deduct hogi.
//     // =====================================================

//     return res.status(201).json({
//       success: true,

//       message:
//         "Night club event booking created successfully",

//       data: booking,
//     });
//   } catch (error) {
//     console.error(
//       "CREATE NIGHT CLUB BOOKING ERROR:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // =====================================================
// // GET MY BOOKINGS
// // =====================================================

// exports.getMyNightClubEventBookings =
//   async (req, res) => {
//     try {
//       const userId = req.user?._id;

//       if (!userId) {
//         return res.status(401).json({
//           success: false,
//           message:
//             "User authentication required",
//         });
//       }

//       const bookings =
//         await NightClubEventBooking.find({
//           userId,
//         })
//           .populate(
//             "eventId",
//             "title eventType eventDate startTime endTime bannerImage"
//           )
//           .populate(
//             "nightClubId",
//             "name city address phone logo coverImage"
//           )
//           .populate(
//             "ticketId",
//             "name ticketType price personsPerTicket"
//           )
//           .sort({
//             createdAt: -1,
//           });

//       return res.status(200).json({
//         success: true,
//         count: bookings.length,
//         data: bookings,
//       });
//     } catch (error) {
//       console.error(
//         "GET MY NIGHT CLUB BOOKINGS ERROR:",
//         error
//       );

//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   };

// // =====================================================
// // GET SINGLE BOOKING
// // =====================================================

// exports.getNightClubEventBookingById =
//   async (req, res) => {
//     try {
//       const userId = req.user?._id;

//       const booking =
//         await NightClubEventBooking.findOne({
//           _id: req.params.id,
//           userId,
//         })
//           .populate(
//             "eventId",
//             "title eventType eventDate startTime endTime bannerImage"
//           )
//           .populate(
//             "nightClubId",
//             "name city address phone logo coverImage"
//           )
//           .populate(
//             "ticketId",
//             "name ticketType price personsPerTicket"
//           );

//       if (!booking) {
//         return res.status(404).json({
//           success: false,
//           message: "Booking not found",
//         });
//       }

//       return res.status(200).json({
//         success: true,
//         data: booking,
//       });
//     } catch (error) {
//       console.error(
//         "GET SINGLE NIGHT CLUB BOOKING ERROR:",
//         error
//       );

//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   };

// // =====================================================
// // CANCEL BOOKING
// // =====================================================

// exports.cancelNightClubEventBooking =
//   async (req, res) => {
//     try {
//       const userId = req.user?._id;

//       const booking =
//         await NightClubEventBooking.findOne({
//           _id: req.params.id,
//           userId,
//         });

//       if (!booking) {
//         return res.status(404).json({
//           success: false,
//           message: "Booking not found",
//         });
//       }

//       if (
//         booking.bookingStatus ===
//         "cancelled"
//       ) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Booking already cancelled",
//         });
//       }

//       if (
//         booking.bookingStatus ===
//         "completed"
//       ) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Completed booking cannot be cancelled",
//         });
//       }

//       // =================================================
//       // IF PAYMENT NOT COMPLETED
//       // =================================================

//       if (
//         booking.paymentStatus !==
//         "paid"
//       ) {
//         booking.bookingStatus =
//           "cancelled";

//         booking.cancelledAt =
//           new Date();

//         booking.cancellationReason =
//           "Cancelled before payment";

//         await booking.save();

//         return res.status(200).json({
//           success: true,
//           message:
//             "Booking cancelled successfully",
//           data: booking,
//         });
//       }

//       // =================================================
//       // PAID BOOKING
//       //
//       // Actual refund process Razorpay module me hoga.
//       // =================================================

//       booking.bookingStatus =
//         "cancelled";

//       booking.cancelledAt =
//         new Date();

//       booking.cancellationReason =
//         req.body.reason ||
//         "Cancelled by customer";

//       await booking.save();

//       return res.status(200).json({
//         success: true,
//         message:
//           "Booking cancellation request processed",
//         data: booking,
//       });
//     } catch (error) {
//       console.error(
//         "CANCEL NIGHT CLUB BOOKING ERROR:",
//         error
//       );

//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   };


// const mongoose = require("mongoose");

// const NightClubEvent = require(
//   "../models/NightClubEvent.model"
// );

// const NightClubEventTicket = require(
//   "../models/NightClubEventTicket.model"
// );

// const NightClubEventBooking = require(
//   "../models/NightClubEventBooking.model"
// );

// // =====================================================
// // GENERATE BOOKING ID
// // =====================================================

// const generateBookingId = () => {
//   const random = Math.random()
//     .toString(36)
//     .substring(2, 8)
//     .toUpperCase();

//   return `NC-${Date.now()}-${random}`;
// };

// // =====================================================
// // CREATE BOOKING
// // =====================================================

// exports.createNightClubEventBooking = async (
//   req,
//   res
// ) => {
//   try {
//     const userId = req.user?._id;

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User authentication required",
//       });
//     }

//     const {
//       eventId,
//       ticketId,
//       quantity,
//       customerName,
//       customerEmail,
//       customerPhone,
//     } = req.body;

//     // =====================================================
//     // VALIDATION
//     // =====================================================

//     if (
//       !eventId ||
//       !ticketId ||
//       !quantity ||
//       !customerName ||
//       !customerEmail ||
//       !customerPhone
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "eventId, ticketId, quantity, customerName, customerEmail and customerPhone are required",
//       });
//     }

//     if (
//       !mongoose.Types.ObjectId.isValid(eventId)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid eventId",
//       });
//     }

//     if (
//       !mongoose.Types.ObjectId.isValid(ticketId)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid ticketId",
//       });
//     }

//     const bookingQuantity = Number(quantity);

//     if (
//       !Number.isInteger(bookingQuantity) ||
//       bookingQuantity < 1
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Quantity must be a valid number greater than 0",
//       });
//     }

//     // =====================================================
//     // FIND EVENT
//     // =====================================================

//     const event = await NightClubEvent.findOne({
//       _id: eventId,
//       status: "published",
//       isPublished: true,
//     });

//     if (!event) {
//       return res.status(404).json({
//         success: false,
//         message:
//           "Event not found or not published",
//       });
//     }

//     // =====================================================
//     // EVENT DATE CHECK
//     // =====================================================

//     const now = new Date();

//     const eventDate = new Date(
//       event.eventDate
//     );

//     if (eventDate < now) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "This event has already started or ended",
//       });
//     }

//     // =====================================================
//     // FIND TICKET
//     // =====================================================

//     const ticket =
//       await NightClubEventTicket.findOne({
//         _id: ticketId,
//         eventId: event._id,
//         isActive: true,
//       });

//     if (!ticket) {
//       return res.status(404).json({
//         success: false,
//         message:
//           "Ticket not found or inactive",
//       });
//     }

//     // =====================================================
//     // TICKET SOLD OUT CHECK
//     // =====================================================

//     if (
//       ticket.isSoldOut ||
//       ticket.availableQuantity <= 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Tickets are sold out",
//       });
//     }

//     // =====================================================
//     // AVAILABLE QUANTITY
//     // =====================================================

//     if (
//       ticket.availableQuantity <
//       bookingQuantity
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Not enough tickets available",
//         availableQuantity:
//           ticket.availableQuantity,
//       });
//     }

//     // =====================================================
//     // SALE START
//     // =====================================================

//     if (
//       ticket.saleStartDate &&
//       now <
//         new Date(ticket.saleStartDate)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Ticket sale has not started yet",
//       });
//     }

//     // =====================================================
//     // SALE END
//     // =====================================================

//     if (
//       ticket.saleEndDate &&
//       now >
//         new Date(ticket.saleEndDate)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Ticket sale has ended",
//       });
//     }

//     // =====================================================
//     // TOTAL CALCULATION
//     // =====================================================

//     const pricePerTicket =
//       Number(ticket.price);

//     const totalAmount =
//       pricePerTicket *
//       bookingQuantity;

//     const personsPerTicket =
//       Number(
//         ticket.personsPerTicket || 1
//       );

//     const totalPersons =
//       bookingQuantity *
//       personsPerTicket;

//     // =====================================================
//     // CHECK EVENT CAPACITY
//     // =====================================================

//     if (
//       typeof event.availableCapacity ===
//         "number" &&
//       event.availableCapacity <
//         totalPersons
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Not enough event capacity available",
//         availableCapacity:
//           event.availableCapacity,
//       });
//     }

//     // =====================================================
//     // PAYMENT EXPIRY
//     // 15 MINUTES
//     // =====================================================

//     const paymentExpiresAt =
//       new Date(
//         Date.now() +
//           15 * 60 * 1000
//       );

//     // =====================================================
//     // CREATE BOOKING
//     // =====================================================

//     const booking =
//       await NightClubEventBooking.create({
//         userId,

//         customerName:
//           customerName.trim(),

//         customerEmail:
//           customerEmail
//             .toLowerCase()
//             .trim(),

//         customerPhone:
//           customerPhone.trim(),

//         vendorId:
//           event.vendorId,

//         nightClubId:
//           event.nightClubId,

//         eventId:
//           event._id,

//         ticketId:
//           ticket._id,

//         ticketName:
//           ticket.name,

//         ticketType:
//           ticket.ticketType,

//         quantity:
//           bookingQuantity,

//         personsPerTicket,

//         totalPersons,

//         pricePerTicket,

//         totalAmount,

//         currency:
//           ticket.currency || "INR",

//         bookingId:
//           generateBookingId(),

//         bookingStatus:
//           "pending",

//         paymentStatus:
//           "pending",

//         paymentMethod:
//           "razorpay",

//         paymentExpiresAt,
//       });

//     // =====================================================
//     // IMPORTANT
//     //
//     // YAHAN TICKET QUANTITY DEDUCT NAHI KAR RAHE.
//     //
//     // Payment successful hone ke baad deduct hogi.
//     // =====================================================

//     return res.status(201).json({
//       success: true,

//       message:
//         "Night club event booking created successfully",

//       data: booking,
//     });
//   } catch (error) {
//     console.error(
//       "CREATE NIGHT CLUB BOOKING ERROR:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // =====================================================
// // GET MY BOOKINGS
// // =====================================================

// exports.getMyNightClubEventBookings =
//   async (req, res) => {
//     try {
//       const userId = req.user?._id;

//       if (!userId) {
//         return res.status(401).json({
//           success: false,
//           message:
//             "User authentication required",
//         });
//       }

//       const bookings =
//         await NightClubEventBooking.find({
//           userId,
//         })
//           .populate(
//             "eventId",
//             "title eventType eventDate startTime endTime bannerImage"
//           )
//           .populate(
//             "nightClubId",
//             "name city address phone logo coverImage"
//           )
//           .populate(
//             "ticketId",
//             "name ticketType price personsPerTicket"
//           )
//           .sort({
//             createdAt: -1,
//           });

//       return res.status(200).json({
//         success: true,
//         count: bookings.length,
//         data: bookings,
//       });
//     } catch (error) {
//       console.error(
//         "GET MY NIGHT CLUB BOOKINGS ERROR:",
//         error
//       );

//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   };

// // =====================================================
// // GET SINGLE BOOKING
// // =====================================================

// exports.getNightClubEventBookingById =
//   async (req, res) => {
//     try {
//       const userId = req.user?._id;

//       const booking =
//         await NightClubEventBooking.findOne({
//           _id: req.params.id,
//           userId,
//         })
//           .populate(
//             "eventId",
//             "title eventType eventDate startTime endTime bannerImage"
//           )
//           .populate(
//             "nightClubId",
//             "name city address phone logo coverImage"
//           )
//           .populate(
//             "ticketId",
//             "name ticketType price personsPerTicket"
//           );

//       if (!booking) {
//         return res.status(404).json({
//           success: false,
//           message: "Booking not found",
//         });
//       }

//       return res.status(200).json({
//         success: true,
//         data: booking,
//       });
//     } catch (error) {
//       console.error(
//         "GET SINGLE NIGHT CLUB BOOKING ERROR:",
//         error
//       );

//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   };

// // =====================================================
// // CANCEL BOOKING
// // =====================================================

// exports.cancelNightClubEventBooking =
//   async (req, res) => {
//     try {
//       const userId = req.user?._id;

//       const booking =
//         await NightClubEventBooking.findOne({
//           _id: req.params.id,
//           userId,
//         });

//       if (!booking) {
//         return res.status(404).json({
//           success: false,
//           message: "Booking not found",
//         });
//       }

//       if (
//         booking.bookingStatus ===
//         "cancelled"
//       ) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Booking already cancelled",
//         });
//       }

//       if (
//         booking.bookingStatus ===
//         "completed"
//       ) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Completed booking cannot be cancelled",
//         });
//       }

//       // =================================================
//       // IF PAYMENT NOT COMPLETED
//       // =================================================

//       if (
//         booking.paymentStatus !==
//         "paid"
//       ) {
//         booking.bookingStatus =
//           "cancelled";

//         booking.cancelledAt =
//           new Date();

//         booking.cancellationReason =
//           "Cancelled before payment";

//         await booking.save();

//         return res.status(200).json({
//           success: true,
//           message:
//             "Booking cancelled successfully",
//           data: booking,
//         });
//       }

//       // =================================================
//       // PAID BOOKING
//       //
//       // Actual refund process Razorpay module me hoga.
//       // =================================================

//       booking.bookingStatus =
//         "cancelled";

//       booking.cancelledAt =
//         new Date();

//       booking.cancellationReason =
//         req.body.reason ||
//         "Cancelled by customer";

//       await booking.save();

//       return res.status(200).json({
//         success: true,
//         message:
//           "Booking cancellation request processed",
//         data: booking,
//       });
//     } catch (error) {
//       console.error(
//         "CANCEL NIGHT CLUB BOOKING ERROR:",
//         error
//       );

//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   };

const mongoose = require("mongoose");

const NightClubEvent = require("../models/NightClubEvent.model");
const NightClubEventTicket = require("../models/NightClubEventTicket.model");
const NightClubEventBooking = require("../models/NightClubEventBooking.model");

/* ==========================================================
   HELPERS
========================================================== */

const generateBookingId = () => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `NC-${Date.now()}-${random}`;
};

const getUserId = (req) => req.user?._id;
const getVendorId = (req) => req.vendor?._id || req.vendor?.id;

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const serverError = (res, label, error) => {
  console.error(`${label}:`, error);
  return fail(res, 500, error.message);
};

const withRelations = (query) =>
  query
    .populate("eventId", "title eventType eventDate startTime endTime bannerImage")
    .populate("nightClubId", "name city address phone logo coverImage")
    .populate("ticketId", "name ticketType price personsPerTicket");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/*
  Razorpay se pending booking ka payment window (paymentExpiresAt) nikal jaye
  to use cancel mark kar deta hai. List khulne par chalta hai, koi cron nahi chahiye.
*/
const expireStaleBookings = async (filter = {}) => {
  try {
    await NightClubEventBooking.updateMany(
      {
        ...filter,
        bookingStatus: "pending",
        paymentStatus: "pending",
        paymentMethod: "razorpay",
        paymentExpiresAt: { $ne: null, $lt: new Date() },
      },
      {
        $set: {
          bookingStatus: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: "Payment window expired",
        },
      }
    );
  } catch (error) {
    console.error("EXPIRE STALE NIGHT CLUB BOOKINGS ERROR:", error.message);
  }
};

/*
  Ticket quantity aur event capacity payment ke baad (payment module mein) ghatti hai.
  Isliye cancel par sirf wahi booking wapas karte hain jo paid + confirmed thi.
*/
const restoreInventory = async (booking) => {
  if (booking.paymentStatus !== "paid" || booking.bookingStatus !== "confirmed") {
    return;
  }

  try {
    const ticket = await NightClubEventTicket.findById(booking.ticketId).lean();

    if (ticket) {
      const inc = { availableQuantity: booking.quantity };
      if (typeof ticket.soldQuantity === "number") {
        inc.soldQuantity = -Math.min(ticket.soldQuantity, booking.quantity);
      }
      await NightClubEventTicket.updateOne(
        { _id: ticket._id },
        { $inc: inc, $set: { isSoldOut: false } }
      );
    }

    const event = await NightClubEvent.findById(booking.eventId).lean();

    if (event && typeof event.availableCapacity === "number") {
      let next = event.availableCapacity + booking.totalPersons;
      if (typeof event.totalCapacity === "number" && event.totalCapacity > 0) {
        next = Math.min(next, event.totalCapacity);
      }
      await NightClubEvent.updateOne(
        { _id: event._id },
        { $set: { availableCapacity: next } }
      );
    }
  } catch (error) {
    console.error("RESTORE NIGHT CLUB INVENTORY ERROR:", error.message);
  }
};

const canDeleteBooking = (booking) =>
  booking.bookingStatus === "cancelled" ||
  (booking.bookingStatus === "pending" && booking.paymentStatus !== "paid");

/* ==========================================================
   CUSTOMER
   Base: /api/nightclub-event-bookings
========================================================== */

/* POST / */
exports.createNightClubEventBooking = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(res, 401, "User authentication required");

    const { eventId, ticketId, quantity, customerName, customerEmail, customerPhone } =
      req.body;

    if (
      !eventId ||
      !ticketId ||
      !quantity ||
      !customerName ||
      !customerEmail ||
      !customerPhone
    ) {
      return fail(
        res,
        400,
        "eventId, ticketId, quantity, customerName, customerEmail and customerPhone are required"
      );
    }

    if (!isValidId(eventId)) return fail(res, 400, "Invalid eventId");
    if (!isValidId(ticketId)) return fail(res, 400, "Invalid ticketId");

    const bookingQuantity = Number(quantity);

    if (!Number.isInteger(bookingQuantity) || bookingQuantity < 1) {
      return fail(res, 400, "Quantity must be a valid number greater than 0");
    }

    const event = await NightClubEvent.findOne({
      _id: eventId,
      status: "published",
      isPublished: true,
    });

    if (!event) return fail(res, 404, "Event not found or not published");

    const now = new Date();

    if (new Date(event.eventDate) < now) {
      return fail(res, 400, "This event has already started or ended");
    }

    const ticket = await NightClubEventTicket.findOne({
      _id: ticketId,
      eventId: event._id,
      isActive: true,
    });

    if (!ticket) return fail(res, 404, "Ticket not found or inactive");

    if (ticket.isSoldOut || ticket.availableQuantity <= 0) {
      return fail(res, 400, "Tickets are sold out");
    }

    if (ticket.availableQuantity < bookingQuantity) {
      return fail(res, 400, "Not enough tickets available", {
        availableQuantity: ticket.availableQuantity,
      });
    }

    if (ticket.saleStartDate && now < new Date(ticket.saleStartDate)) {
      return fail(res, 400, "Ticket sale has not started yet");
    }

    if (ticket.saleEndDate && now > new Date(ticket.saleEndDate)) {
      return fail(res, 400, "Ticket sale has ended");
    }

    const pricePerTicket = Number(ticket.price);
    const totalAmount = pricePerTicket * bookingQuantity;
    const personsPerTicket = Number(ticket.personsPerTicket || 1);
    const totalPersons = bookingQuantity * personsPerTicket;

    if (
      typeof event.availableCapacity === "number" &&
      event.availableCapacity < totalPersons
    ) {
      return fail(res, 400, "Not enough event capacity available", {
        availableCapacity: event.availableCapacity,
      });
    }

    const paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const booking = await NightClubEventBooking.create({
      userId,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail).toLowerCase().trim(),
      customerPhone: String(customerPhone).trim(),

      vendorId: event.vendorId,
      nightClubId: event.nightClubId,
      eventId: event._id,

      ticketId: ticket._id,
      ticketName: ticket.name,
      ticketType: ticket.ticketType,
      quantity: bookingQuantity,
      personsPerTicket,
      totalPersons,

      pricePerTicket,
      totalAmount,
      currency: ticket.currency || "INR",

      bookingId: generateBookingId(),
      bookingStatus: "pending",
      paymentStatus: "pending",
      paymentMethod: "razorpay",
      paymentExpiresAt,
    });

    return res.status(201).json({
      success: true,
      message: "Night club event booking created successfully",
      data: booking,
    });
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, 409, "Booking ID already exists. Please try again.");
    }
    return serverError(res, "CREATE NIGHT CLUB BOOKING ERROR", error);
  }
};

/* GET /my-bookings */
exports.getMyNightClubEventBookings = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(res, 401, "User authentication required");

    await expireStaleBookings({ userId });

    const bookings = await withRelations(
      NightClubEventBooking.find({ userId }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    return serverError(res, "GET MY NIGHT CLUB BOOKINGS ERROR", error);
  }
};

/* GET /:id */
exports.getNightClubEventBookingById = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(res, 401, "User authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await withRelations(
      NightClubEventBooking.findOne({ _id: req.params.id, userId })
    );

    if (!booking) return fail(res, 404, "Booking not found");

    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return serverError(res, "GET SINGLE NIGHT CLUB BOOKING ERROR", error);
  }
};

/* PUT /:id   (sirf contact details badal sakte hain) */
exports.updateNightClubEventBooking = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(res, 401, "User authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await NightClubEventBooking.findOne({
      _id: req.params.id,
      userId,
    });

    if (!booking) return fail(res, 404, "Booking not found");

    if (!["pending", "confirmed"].includes(booking.bookingStatus)) {
      return fail(
        res,
        400,
        `A ${booking.bookingStatus} booking cannot be edited`
      );
    }

    const { customerName, customerEmail, customerPhone } = req.body;

    if (customerName !== undefined) {
      if (!String(customerName).trim()) return fail(res, 400, "Name cannot be empty");
      booking.customerName = String(customerName).trim();
    }

    if (customerEmail !== undefined) {
      if (!String(customerEmail).trim()) return fail(res, 400, "Email cannot be empty");
      booking.customerEmail = String(customerEmail).toLowerCase().trim();
    }

    if (customerPhone !== undefined) {
      if (!String(customerPhone).trim()) return fail(res, 400, "Phone cannot be empty");
      booking.customerPhone = String(customerPhone).trim();
    }

    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    return serverError(res, "UPDATE NIGHT CLUB BOOKING ERROR", error);
  }
};

/* PATCH /:id/cancel */
exports.cancelNightClubEventBooking = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(res, 401, "User authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await NightClubEventBooking.findOne({
      _id: req.params.id,
      userId,
    });

    if (!booking) return fail(res, 404, "Booking not found");

    if (booking.bookingStatus === "cancelled") {
      return fail(res, 400, "Booking already cancelled");
    }

    if (["completed", "refunded"].includes(booking.bookingStatus)) {
      return fail(res, 400, `A ${booking.bookingStatus} booking cannot be cancelled`);
    }

    const wasPaid = booking.paymentStatus === "paid";

    await restoreInventory(booking);

    booking.bookingStatus = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancellationReason = wasPaid
      ? req.body?.reason || "Cancelled by customer"
      : req.body?.reason || "Cancelled before payment";

    await booking.save();

    return res.status(200).json({
      success: true,
      message: wasPaid
        ? "Booking cancellation request processed"
        : "Booking cancelled successfully",
      data: booking,
    });
  } catch (error) {
    return serverError(res, "CANCEL NIGHT CLUB BOOKING ERROR", error);
  }
};

/* DELETE /:id   (sirf cancelled ya unpaid pending booking) */
exports.deleteNightClubEventBooking = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return fail(res, 401, "User authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await NightClubEventBooking.findOne({
      _id: req.params.id,
      userId,
    });

    if (!booking) return fail(res, 404, "Booking not found");

    if (!canDeleteBooking(booking)) {
      return fail(
        res,
        400,
        "Only cancelled or unpaid pending bookings can be deleted. Cancel the booking first."
      );
    }

    await booking.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    return serverError(res, "DELETE NIGHT CLUB BOOKING ERROR", error);
  }
};

/* ==========================================================
   VENDOR
   Base: /api/nightclub-event-bookings/vendor
========================================================== */

/* GET /vendor   (?status=pending,confirmed &paymentStatus= &eventId= &nightClubId=) */
exports.getVendorNightClubEventBookings = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required");

    await expireStaleBookings({ vendorId });

    const filter = { vendorId };

    if (req.query.status) {
      filter.bookingStatus = { $in: String(req.query.status).split(",") };
    }
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    if (req.query.eventId && isValidId(req.query.eventId)) {
      filter.eventId = req.query.eventId;
    }
    if (req.query.nightClubId && isValidId(req.query.nightClubId)) {
      filter.nightClubId = req.query.nightClubId;
    }

    const bookings = await withRelations(
      NightClubEventBooking.find(filter).sort({ createdAt: -1 }).limit(1000)
    );

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    return serverError(res, "GET VENDOR NIGHT CLUB BOOKINGS ERROR", error);
  }
};

/* GET /vendor/:id */
exports.getVendorNightClubEventBookingById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await withRelations(
      NightClubEventBooking.findOne({ _id: req.params.id, vendorId })
    );

    if (!booking) return fail(res, 404, "Booking not found");

    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    return serverError(res, "GET VENDOR NIGHT CLUB BOOKING ERROR", error);
  }
};

const findVendorBooking = (req, vendorId) =>
  NightClubEventBooking.findOne({ _id: req.params.id, vendorId });

const sendPopulated = async (res, booking, message) => {
  const populated = await withRelations(NightClubEventBooking.findById(booking._id));
  return res.status(200).json({ success: true, message, data: populated });
};

/* PATCH /vendor/:id/confirm   (pending -> confirmed) */
exports.confirmVendorNightClubEventBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await findVendorBooking(req, vendorId);
    if (!booking) return fail(res, 404, "Booking not found");

    if (booking.bookingStatus !== "pending") {
      return fail(
        res,
        400,
        `Only pending bookings can be confirmed. Current status: ${booking.bookingStatus}.`
      );
    }

    booking.bookingStatus = "confirmed";
    booking.confirmedAt = new Date();
    await booking.save();

    return sendPopulated(res, booking, "Booking confirmed");
  } catch (error) {
    return serverError(res, "CONFIRM NIGHT CLUB BOOKING ERROR", error);
  }
};

/* PATCH /vendor/:id/check-in   (confirmed guest ki entry) */
exports.checkInVendorNightClubEventBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await findVendorBooking(req, vendorId);
    if (!booking) return fail(res, 404, "Booking not found");

    if (booking.bookingStatus !== "confirmed") {
      return fail(res, 400, "Only confirmed bookings can be checked in");
    }

    if (booking.entryStatus === "checked_in") {
      return fail(res, 400, "Guest is already checked in");
    }

    booking.entryStatus = "checked_in";
    booking.checkedInAt = new Date();
    await booking.save();

    return sendPopulated(res, booking, "Guest checked in");
  } catch (error) {
    return serverError(res, "CHECK-IN NIGHT CLUB BOOKING ERROR", error);
  }
};

/* PATCH /vendor/:id/complete   (confirmed -> completed) */
exports.completeVendorNightClubEventBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await findVendorBooking(req, vendorId);
    if (!booking) return fail(res, 404, "Booking not found");

    if (booking.bookingStatus !== "confirmed") {
      return fail(
        res,
        400,
        `Only confirmed bookings can be completed. Current status: ${booking.bookingStatus}.`
      );
    }

    booking.bookingStatus = "completed";
    await booking.save();

    return sendPopulated(res, booking, "Booking marked as completed");
  } catch (error) {
    return serverError(res, "COMPLETE NIGHT CLUB BOOKING ERROR", error);
  }
};

/* PATCH /vendor/:id/cancel */
exports.cancelVendorNightClubEventBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await findVendorBooking(req, vendorId);
    if (!booking) return fail(res, 404, "Booking not found");

    if (!["pending", "confirmed"].includes(booking.bookingStatus)) {
      return fail(
        res,
        400,
        `A ${booking.bookingStatus} booking cannot be cancelled`
      );
    }

    const wasPaid = booking.paymentStatus === "paid";

    await restoreInventory(booking);

    booking.bookingStatus = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancellationReason = req.body?.reason || "Cancelled by vendor";
    await booking.save();

    return sendPopulated(
      res,
      booking,
      wasPaid
        ? "Booking cancelled. Payment was already received, please process the refund."
        : "Booking cancelled"
    );
  } catch (error) {
    return serverError(res, "CANCEL VENDOR NIGHT CLUB BOOKING ERROR", error);
  }
};

/* DELETE /vendor/:id   (sirf cancelled ya unpaid pending) */
exports.deleteVendorNightClubEventBooking = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return fail(res, 401, "Vendor authentication required");
    if (!isValidId(req.params.id)) return fail(res, 400, "Invalid booking id");

    const booking = await findVendorBooking(req, vendorId);
    if (!booking) return fail(res, 404, "Booking not found");

    if (!canDeleteBooking(booking)) {
      return fail(
        res,
        400,
        "Only cancelled or unpaid pending bookings can be deleted. Cancel the booking first."
      );
    }

    await booking.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Booking deleted",
    });
  } catch (error) {
    return serverError(res, "DELETE VENDOR NIGHT CLUB BOOKING ERROR", error);
  }
};