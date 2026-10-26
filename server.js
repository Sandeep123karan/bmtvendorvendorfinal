

require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const advertisementRoutes = require("./routes/advertisement.routes");
const vendorReviewRoutes = require("./routes/vendorReview.routes");
const connectDB = require("./config/db");

const app = express();

/* ==============================
   CORS CONFIGURATION
============================== */

const allowedOrigins = [
  // Production frontends
  "https://vendor.birdmytrip.com",
  "https://www.vendor.birdmytrip.com",
  "https://birdmytrip.com",
  "https://www.birdmytrip.com",

  // Local development
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error("CORS blocked origin:", origin);

    return callback(
      new Error(`CORS blocked for origin: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Range",
  ],

  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));

/* ==============================
   SECURITY & PERFORMANCE
============================== */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

app.use(compression());
app.use(morgan("dev"));

/* ==============================
   BODY PARSERS
============================== */

app.use(express.json({ limit: "50mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

/* ==============================
   DATABASE CONNECTION
============================== */

connectDB();

/* ==============================
   SAFE ROUTE LOADER
============================== */

function loadRouter(file, exportName) {
  let mod;

  try {
    mod = require(file);
  } catch (err) {
    console.error(
      `Cannot load ${file}: ${err.message}`
    );
    return null;
  }

  const candidates = [
    exportName && mod && mod[exportName],
    mod,
    mod && mod.default,
    mod && mod.router,
  ].filter(Boolean);

  const router = candidates.find(
    (candidate) => typeof candidate === "function"
  );

  if (!router) {
    console.error(
      `${file} does not export a valid router` +
        (exportName
          ? ` (looking for "${exportName}")`
          : "") +
        `. Found exports: [${Object.keys(
          mod || {}
        ).join(", ")}]`
    );

    return null;
  }

  return router;
}

/* ==============================
   ROUTES TABLE
============================== */

const routes = [
  // AUTH
  ["/api/vendor/auth", "./routes/auth.routes"],
  ["/api/user/auth", "./routes/userAuth.routes"],
  [
    "/api/bmt-partner/auth",
    "./routes/bmtPartnerAuth.routes",
  ],

  // UPLOAD
  ["/api/upload", "./routes/Upload.routes"],

  // TOURS
  ["/api/vendor/tours", "./routes/tour.routes"],
  [
    "/api/vendor/tour-bookings",
    "./routes/tourBooking.routes",
  ],
  [
    "/api/customer/tour-bookings",
    "./routes/tourBooking.routes",
  ],
  [
    "/api/customer/tour-queries",
    "./routes/tourQuery.routes",
    "customerTourQueryRoutes",
  ],
  [
    "/api/vendor/tour-queries",
    "./routes/tourQuery.routes",
    "vendorTourQueryRoutes",
  ],
  [
    "/api/vendor/tour-schedules",
    "./routes/tourSchedule.routes",
  ],
  ["/api/tour-reviews", "./routes/tourReview.routes"],

  // ACTIVITIES
  ["/api/vendor/activities", "./routes/activity.routes"],
  [
    "/api/vendor/activity-schedules",
    "./routes/activitySchedule.routes",
  ],
  [
    "/api/activity-bookings",
    "./routes/activityBooking.routes",
  ],

  // HOTELS
  ["/api/vendor/hotels", "./routes/hotel.routes"],
  ["/api/hotel-rooms", "./routes/HotelRoom.routes"],
  ["/api/hotel-booking", "./routes/hotelBooking.routes"],
  [
    "/api/hotel-inventory",
    "./routes/HotelInventory.routes",
  ],

  // NIGHTCLUBS
  ["/api/vendor/nightclubs", "./routes/nightclub.routes"],
  ["/api/nightclubs", "./routes/nightclub.routes"],
  [
    "/api/nightclub-events",
    "./routes/nightClubEvent.routes",
  ],
  [
    "/api/nightclub-event-tickets",
    "./routes/nightclubEventTicket.routes",
  ],
  [
    "/api/nightclub-event-bookings",
    "./routes/nightclubEventBooking.routes",
  ],
  [
    "/api/vendor/nightclub-tables",
    "./routes/nightClubTable.routes",
  ],
  [
    "/api/nightclub-table-pricing",
    "./routes/nightClubTablePricing.routes",
  ],

  // DARSHAN
  ["/api/vendor/darshans", "./routes/darshan.routes"],
  [
    "/api/vendor/darshan-types",
    "./routes/darshanType.routes",
  ],
  [
    "/api/vendor/darshan-slots",
    "./routes/darshanSlot.routes",
  ],
  [
    "/api/vendor/darshan-slot-availability",
    "./routes/darshanSlotAvailability.routes",
  ],
  [
    "/api/darshan-bookings",
    "./routes/darshanBooking.routes",
  ],
  [
    "/api/vendor/darshans",
    "./routes/vendorDarshanRoutes",
  ],

  // CABS
  ["/api/vendor/cabs", "./routes/cab.routes"],
  ["/api/cabs", "./routes/cabBooking.routes"],

  // BUS
  ["/api/buses", "./routes/bus.routes"],
  ["/api/bus-types", "./routes/busType.routes"],
  [
    "/api/bus-seat-layouts",
    "./routes/busSeatLayout.routes",
  ],
  ["/api/bus-trips", "./routes/busTrip.routes"],
  ["/api/bus-bookings", "./routes/busBooking.routes"],

  // FLIGHTS
  ["/api/flights", "./routes/flight.routes"],
  [
    "/api/flight-bookings",
    "./routes/flightBooking.routes",
  ],

  // HOMESTAY
  ["/api/vendor/homestay", "./routes/homestay.routes"],
  [
    "/api/homestay-units",
    "./routes/homestayUnit.routes",
  ],
  ["/api/vendor/homestay-rooms", "./routes/homestayRoom.routes"],
  [
    "/api/homestay-inventory",
    "./routes/homestayInventory.routes",
  ],
  [
    "/api/homestay-bookings",
    "./routes/homestayBooking.routes",
  ],
  [
    "/api/homestay-reviews",
    "./routes/homestayReview.routes",
  ],

  // HOLIDAY / BNB
  ["/api/vendor/holidays", "./routes/holiday.routes"],
  ["/api/vendor/bnb", "./routes/bnbRoutes"],
  [
    "/api/holiday-bookings",
    "./routes/holidayBooking.routes",
  ],

  // APARTMENT
  ["/api/vendor/apartment", "./routes/Apartment.routes"],
  [
    "/api/apartment-inventory",
    "./routes/apartmentInventory.routes",
  ],
  [
    "/api/apartment-rate-plans",
    "./routes/apartmentRatePlan.routes",
  ],
  [
    "/api/apartment-dynamic-pricing",
    "./routes/apartmentDynamicPricing.routes",
  ],
  [
    "/api/apartment-bookings",
    "./routes/apartmentBooking.routes",
  ],

  // VACATION HOUSE / PALACE / MOTEL
  ["/api/vacation-house", "./routes/vacationHouseRoutes"],
  [
  "/api/vacation-house-inventory",
  "./routes/vacationHouseInventoryRoutes",
],
  ["/api/palaces", "./routes/palaceRoutes"],
  [
    "/api/palace-room-categories",
    "./routes/palaceRoomCategoryRoutes",
  ],
  [
    "/api/palace-room-units",
    "./routes/palaceRoomUnitRoutes",
  ],
  [
    "/api/palace-rate-plans",
    "./routes/palaceRatePlanRoutes",
  ],
  // RATINGS & REVIEWS
[
  "/api/vendor/reviews",
  "./routes/vendorReview.routes",
],
  [
    "/api/palace-inventory",
    "./routes/palaceInventoryRoutes",
  ],
  [
  "/api/palace-bookings",
  "./routes/palaceBookingRoutes",
],
  ["/api/motel-vendors", "./routes/motelVendorRoutes"],
  

  // RESORT
  ["/api/resorts", "./routes/resort.routes"],
  ["/api/resort-rooms", "./routes/resortRoom.routes"],
  [
    "/api/resort-room-units",
    "./routes/resortRoomUnit.routes",
  ],
  [
    "/api/resort-inventory",
    "./routes/resortInventory.routes",
  ],
  [
    "/api/resort-rate-plans",
    "./routes/resortRatePlan.routes",
  ],
  [
    "/api/resort-pricing",
    "./routes/resortPricing.routes",
  ],
  [
    "/api/resort-bookings",
    "./routes/resortBooking.routes",
  ],
  [
    "/api/resort-reviews",
    "./routes/resortReview.routes",
  ],
    // HOSTELS
 // HOSTELS
["/api/vendor/hostels", "./routes/hostel.routes"],
["/api/vendor/hostel-rooms", "./routes/hostelRoom.routes"],
// VILLA
["/api/vendor/villas", "./routes/villa.routes"],
["/api/vendor/villas", "./routes/villaRoom.routes"],
// VILLA ROOM INVENTORY
[
  "/api/vendor/villas",
  "./routes/villaRoomInventory.routes",
],
[
  "/api/vendor/villas",
  "./routes/villaRoomPricing.routes",
],
[
  "/api/vendor/villas",
  "./routes/villaBooking.routes",
],
  // CAMPSITE
  [
    "/api/vendor/campsite",
    "./routes/vendorCampsite.routes",
  ],
  // ADVERTISEMENTS
["/api/vendor/advertisements", "./routes/advertisement.routes"],
// SUPPORT
["/api/vendor/support", "./routes/support.routes"],
  // CRUISE
  [
    "/api/vendor/cruise/ships",
    "./routes/cruiseShip.routes",
  ],
  ["/api/cruise-cabins", "./routes/cruiseCabin.routes"],
  [
    "/api/cruise-itineraries",
    "./routes/cruiseItinerary.routes",
  ],
  [
    "/api/cruise-sailings",
    "./routes/cruiseSailing.routes",
  ],
  [
    "/api/cruise-pricings",
    "./routes/cruisePricing.routes",
  ],
  [
    "/api/cruise-availabilities",
    "./routes/cruiseAvailability.routes",
  ],
  ["/api/vendor/offers", "./routes/vendorOffer.routes"],
[
    "/api/customer/cruise-bookings",
    "./routes/cruiseBooking.routes",
    "customerCruiseBookingRoutes",
  ],
  [
    "/api/vendor/cruise-bookings",
    "./routes/cruiseBooking.routes",
    "vendorCruiseBookingRoutes",
  ],
];



/* ==============================
   MOUNT ROUTES
============================== */

const failedRoutes = [];

routes.forEach(([path, file, exportName]) => {
  const router = loadRouter(file, exportName);

  if (router) {
    app.use(path, router);
    console.log(`Route mounted: ${path}`);
  } else {
    failedRoutes.push(
      `${path} -> ${file}${
        exportName ? ` [${exportName}]` : ""
      }`
    );
  }
});

if (failedRoutes.length > 0) {
  console.error("\nThese routes were skipped:");

  failedRoutes.forEach((route) => {
    console.error(` - ${route}`);
  });
}

/* ==============================
   HEALTH CHECKS
============================== */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Vendor Backend Running Successfully",
    service: "BirdMyTrip Vendor API",
    environment: process.env.NODE_ENV || "development",
    port: process.env.PORT || 7000,
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

/* ==============================
   404 HANDLERS
============================== */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

/* ==============================
   GLOBAL ERROR HANDLER
============================== */

app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  if (err.message && err.message.startsWith("CORS blocked")) {
    return res.status(403).json({
      success: false,
      message: "CORS origin not allowed",
      origin: req.headers.origin || null,
    });
  }

  const statusCode = err.status || err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* ==============================
   START SERVER
============================== */

const PORT = process.env.PORT || 7000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("BIRD MY TRIP VENDOR BACKEND");
  console.log(`Server running on port: ${PORT}`);
  console.log(
    `Environment: ${process.env.NODE_ENV || "development"}`
  );
  console.log("Frontend: https://vendor.birdmytrip.com");
  console.log("Health: /api/health");
  console.log(
    "CORS: localhost:3000, localhost:3001, localhost:5173"
  );
  console.log("========================================");
});
