const CabBooking = require("../models/CabBooking.model");
const Cab = require("../models/Cab.model");

/* =========================================================
   HELPERS
========================================================= */

const POPULATE_CAB = "cabType vehicleNumber fromCity toCity price vendor";

const ok = (res, data, message = "OK", status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const serverError = (res, label, error) => {
  console.error(`${label} error:`, error);
  return fail(res, 500, error.message || "Something went wrong");
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const makeBookingId = () =>
  `CAB${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

const USER_CANCELLABLE = ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED"];
const VENDOR_CANCELLABLE = ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "STARTED"];

const isDeletable = (b) =>
  b.bookingStatus === "CANCELLED" ||
  (b.bookingStatus === "PENDING" && b.paymentStatus !== "PAID");

/* =========================================================
   USER  -  CREATE BOOKING        POST /api/cabs
   (user login required, price server pe calculate hota hai)
========================================================= */
exports.createBooking = async (req, res) => {
  try {
    const {
      cabId,
      customer,
      tripType,
      fromCity,
      toCity,
      pickupAddress,
      dropAddress,
      pickupDate,
      pickupTime,
      returnDate,
      returnTime,
      passengers,
      paymentMethod,
      specialRequests,
    } = req.body;

    if (!cabId) return fail(res, 400, "Cab ID is required");
    if (!pickupDate) return fail(res, 400, "Pickup date is required");
    if (!pickupTime) return fail(res, 400, "Pickup time is required");

    const pickup = new Date(pickupDate);
    if (isNaN(pickup) || pickup < startOfToday()) {
      return fail(res, 400, "Pickup date must be today or a future date");
    }

    if (tripType === "ROUND_TRIP") {
      const ret = new Date(returnDate);
      if (isNaN(ret) || ret < pickup) {
        return fail(res, 400, "Return date must be on or after pickup date");
      }
    }

    const cab = await Cab.findById(cabId);
    if (!cab) return fail(res, 404, "Cab not found");
    if (!cab.isActive) return fail(res, 400, "Cab is currently not available");

    const name = customer?.name || req.user.fullname || req.user.name || "";
    const phone = customer?.phone || req.user.phone || "";
    if (!name || !phone) {
      return fail(res, 400, "Customer name and phone are required");
    }

    // Price client se nahi, cab se aayega
    const baseFare = Number(cab.price) || 0;
    const driverAllowance = Number(cab.driverAllowance) || 0;
    const tollCharges = Number(cab.tollCharges) || 0;
    const stateTax = Number(cab.stateTax) || 0;
    const gstPercentage = Number(cab.gstPercentage) || 0;
    const subtotal = baseFare + driverAllowance + tollCharges + stateTax;
    const gstAmount = Math.round((subtotal * gstPercentage) / 100);

    const list = Array.isArray(passengers) ? passengers : [];

    const booking = await CabBooking.create({
      bookingId: makeBookingId(),
      cab: cab._id,
      vendor: cab.vendor,
      user: req.user._id,

      customer: {
        name,
        email: customer?.email || req.user.email || "",
        phone,
      },

      tripType: tripType || "ONE_WAY",
      fromCity: fromCity || cab.fromCity || "",
      toCity: toCity || cab.toCity || "",
      pickupAddress: pickupAddress || "",
      dropAddress: dropAddress || "",
      pickupDate: pickup,
      pickupTime,
      returnDate: tripType === "ROUND_TRIP" ? returnDate : null,
      returnTime: tripType === "ROUND_TRIP" ? returnTime || "" : "",

      passengers: list,
      totalPassengers: list.length > 0 ? list.length : 1,

      pricing: {
        baseFare,
        driverAllowance,
        tollCharges,
        stateTax,
        gstPercentage,
        gstAmount,
        discount: 0,
        totalAmount: subtotal + gstAmount,
        currency: "INR",
      },

      paymentMethod: paymentMethod || "ONLINE",
      bookingStatus: "PENDING",
      specialRequests: specialRequests || "",
    });

    return ok(res, booking, "Cab booking created successfully", 201);
  } catch (error) {
    return serverError(res, "createBooking", error);
  }
};

/* =========================================================
   USER  -  MY BOOKINGS           GET /api/cabs/my-bookings
========================================================= */
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await CabBooking.find({ user: req.user._id })
      .populate("cab", POPULATE_CAB)
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    return serverError(res, "getMyBookings", error);
  }
};

/* =========================================================
   USER  -  SINGLE BOOKING        GET /api/cabs/:id
========================================================= */
exports.getMyBookingById = async (req, res) => {
  try {
    const booking = await CabBooking.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate("cab", POPULATE_CAB);

    if (!booking) return fail(res, 404, "Booking not found");
    return ok(res, booking);
  } catch (error) {
    return serverError(res, "getMyBookingById", error);
  }
};

/* =========================================================
   USER  -  UPDATE BOOKING        PUT /api/cabs/:id
   Sirf PENDING booking edit ho sakti hai. Route aur price lock hain.
========================================================= */
exports.updateMyBooking = async (req, res) => {
  try {
    const booking = await CabBooking.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!booking) return fail(res, 404, "Booking not found");
    if (booking.bookingStatus !== "PENDING") {
      return fail(res, 400, "Only pending bookings can be edited");
    }

    const b = req.body;

    if (b.pickupDate !== undefined) {
      const d = new Date(b.pickupDate);
      if (isNaN(d) || d < startOfToday()) {
        return fail(res, 400, "Pickup date must be today or a future date");
      }
      booking.pickupDate = d;
    }

    ["pickupAddress", "dropAddress", "pickupTime", "returnTime", "specialRequests"].forEach(
      (k) => {
        if (b[k] !== undefined) booking[k] = b[k];
      }
    );

    if (b.returnDate !== undefined) booking.returnDate = b.returnDate || null;

    if (b.customer) {
      ["name", "email", "phone"].forEach((k) => {
        if (b.customer[k] !== undefined) booking.customer[k] = b.customer[k];
      });
    }

    if (Array.isArray(b.passengers)) {
      booking.passengers = b.passengers;
      booking.totalPassengers = b.passengers.length || 1;
    }

    if (
      booking.tripType === "ROUND_TRIP" &&
      booking.returnDate &&
      booking.returnDate < booking.pickupDate
    ) {
      return fail(res, 400, "Return date must be on or after pickup date");
    }

    await booking.save();
    return ok(res, booking, "Booking updated successfully");
  } catch (error) {
    return serverError(res, "updateMyBooking", error);
  }
};

/* =========================================================
   USER  -  CANCEL BOOKING        PATCH /api/cabs/:id/cancel
========================================================= */
exports.cancelMyBooking = async (req, res) => {
  try {
    const booking = await CabBooking.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!booking) return fail(res, 404, "Booking not found");
    if (!USER_CANCELLABLE.includes(booking.bookingStatus)) {
      return fail(res, 400, `A ${booking.bookingStatus.toLowerCase()} booking cannot be cancelled`);
    }

    booking.bookingStatus = "CANCELLED";
    booking.cancellationReason = req.body?.reason || "";
    booking.cancelledBy = "USER";
    booking.cancelledAt = new Date();
    await booking.save();

    return ok(res, booking, "Booking cancelled successfully");
  } catch (error) {
    return serverError(res, "cancelMyBooking", error);
  }
};

/* =========================================================
   USER  -  DELETE BOOKING        DELETE /api/cabs/:id
========================================================= */
exports.deleteMyBooking = async (req, res) => {
  try {
    const booking = await CabBooking.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!booking) return fail(res, 404, "Booking not found");
    if (!isDeletable(booking)) {
      return fail(res, 400, "Only cancelled or unpaid pending bookings can be deleted");
    }

    await booking.deleteOne();
    return ok(res, null, "Booking deleted successfully");
  } catch (error) {
    return serverError(res, "deleteMyBooking", error);
  }
};

/* =========================================================
   VENDOR  -  LIST          GET /api/cabs/vendor/my-bookings
========================================================= */
exports.getVendorBookings = async (req, res) => {
  try {
    const bookings = await CabBooking.find({ vendor: req.vendor._id })
      .populate("cab", POPULATE_CAB)
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    return serverError(res, "getVendorBookings", error);
  }
};

/* =========================================================
   VENDOR  -  SINGLE        GET /api/cabs/vendor/:id
========================================================= */
exports.getBookingById = async (req, res) => {
  try {
    const booking = await CabBooking.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    }).populate("cab", POPULATE_CAB);

    if (!booking) return fail(res, 404, "Booking not found");
    return ok(res, booking);
  } catch (error) {
    return serverError(res, "getBookingById", error);
  }
};

/* =========================================================
   VENDOR  -  helper to load own booking
========================================================= */
const loadVendorBooking = (req) =>
  CabBooking.findOne({ _id: req.params.id, vendor: req.vendor._id }).populate(
    "cab",
    POPULATE_CAB
  );

/* =========================================================
   VENDOR  -  CONFIRM
========================================================= */
exports.confirmBooking = async (req, res) => {
  try {
    const booking = await loadVendorBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");

    if (booking.bookingStatus !== "PENDING") {
      return fail(res, 400, "Only pending bookings can be confirmed");
    }

    booking.bookingStatus = "CONFIRMED";
    booking.confirmedAt = new Date();
    await booking.save();

    return ok(res, booking, "Booking confirmed successfully");
  } catch (error) {
    return serverError(res, "confirmBooking", error);
  }
};

/* =========================================================
   VENDOR  -  ASSIGN DRIVER
========================================================= */
exports.assignDriver = async (req, res) => {
  try {
    const { name, phone, vehicleNumber } = req.body;

    if (!name?.trim() || !phone?.trim()) {
      return fail(res, 400, "Driver name and phone are required");
    }

    const booking = await loadVendorBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");

    if (!["CONFIRMED", "DRIVER_ASSIGNED"].includes(booking.bookingStatus)) {
      return fail(res, 400, "Confirm the booking before assigning a driver");
    }

    booking.driverDetails = {
      name: name.trim(),
      phone: phone.trim(),
      vehicleNumber: (vehicleNumber || "").trim(),
      assignedAt: new Date(),
    };
    booking.bookingStatus = "DRIVER_ASSIGNED";
    await booking.save();

    return ok(res, booking, "Driver assigned successfully");
  } catch (error) {
    return serverError(res, "assignDriver", error);
  }
};

/* =========================================================
   VENDOR  -  START TRIP
========================================================= */
exports.startTrip = async (req, res) => {
  try {
    const booking = await loadVendorBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");

    if (!["CONFIRMED", "DRIVER_ASSIGNED"].includes(booking.bookingStatus)) {
      return fail(res, 400, "Booking must be confirmed before starting the trip");
    }

    booking.bookingStatus = "STARTED";
    booking.startedAt = new Date();
    await booking.save();

    return ok(res, booking, "Trip started successfully");
  } catch (error) {
    return serverError(res, "startTrip", error);
  }
};

/* =========================================================
   VENDOR  -  COMPLETE TRIP
========================================================= */
exports.completeTrip = async (req, res) => {
  try {
    const booking = await loadVendorBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");

    if (booking.bookingStatus !== "STARTED") {
      return fail(res, 400, "Trip must be started before completing");
    }

    booking.bookingStatus = "COMPLETED";
    booking.completedAt = new Date();
    await booking.save();

    return ok(res, booking, "Trip completed successfully");
  } catch (error) {
    return serverError(res, "completeTrip", error);
  }
};

/* =========================================================
   VENDOR  -  CANCEL
========================================================= */
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await loadVendorBooking(req);
    if (!booking) return fail(res, 404, "Booking not found");

    if (!VENDOR_CANCELLABLE.includes(booking.bookingStatus)) {
      return fail(res, 400, `A ${booking.bookingStatus.toLowerCase()} booking cannot be cancelled`);
    }

    booking.bookingStatus = "CANCELLED";
    booking.cancellationReason = req.body?.reason || req.body?.cancellationReason || "";
    booking.cancelledBy = "VENDOR";
    booking.cancelledAt = new Date();
    await booking.save();

    return ok(res, booking, "Booking cancelled successfully");
  } catch (error) {
    return serverError(res, "cancelBooking", error);
  }
};

/* =========================================================
   VENDOR  -  DELETE
========================================================= */
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await CabBooking.findOne({
      _id: req.params.id,
      vendor: req.vendor._id,
    });

    if (!booking) return fail(res, 404, "Booking not found");
    if (!isDeletable(booking)) {
      return fail(res, 400, "Only cancelled or unpaid pending bookings can be deleted");
    }

    await booking.deleteOne();
    return ok(res, null, "Booking deleted successfully");
  } catch (error) {
    return serverError(res, "deleteBooking", error);
  }
};


/* =========================================================
   VENDOR  -  DASHBOARD          GET /api/cabs/vendor/dashboard?range=today|week|month
   Saara data DB se calculate hota hai, kuch static nahi.
   today = aaj, week = last 7 days, month = last 30 days
========================================================= */
const RANGE_DAYS = { today: 1, week: 7, month: 30 };

const cabDriverOf = (c) => ({
  name: c.driver?.name || c.driverName || "",
  phone: c.driver?.phone || c.driverPhone || "",
  license: c.driver?.licenseNumber || c.driverLicenseNumber || "",
});

const summarize = (list) => {
  const live = list.filter((b) => b.bookingStatus !== "CANCELLED");
  const paid = live.filter((b) => b.paymentStatus === "PAID");
  return {
    rides: live.length,
    revenue: paid.reduce((s, b) => s + (b.pricing?.totalAmount || 0), 0),
    paidCount: paid.length,
    completed: live.filter((b) => b.bookingStatus === "COMPLETED").length,
    cancelled: list.length - live.length,
  };
};

const pctChange = (cur, prev) =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;

exports.getVendorDashboard = async (req, res) => {
  try {
    const range = RANGE_DAYS[req.query.range] ? req.query.range : "today";
    const days = RANGE_DAYS[range];
    const vendor = req.vendor._id;

    const start = startOfToday();
    start.setDate(start.getDate() - (days - 1));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);

    const [cabs, periodBookings, startedTrips, recent, pendingCount, upcomingCount] =
      await Promise.all([
        Cab.find({ vendor }).lean(),
        CabBooking.find({ vendor, createdAt: { $gte: prevStart } }).lean(),
        CabBooking.find({ vendor, bookingStatus: "STARTED" }).select("cab").lean(),
        CabBooking.find({ vendor }).sort({ createdAt: -1 }).limit(8).lean(),
        CabBooking.countDocuments({ vendor, bookingStatus: "PENDING" }),
        CabBooking.countDocuments({
          vendor,
          bookingStatus: { $in: ["CONFIRMED", "DRIVER_ASSIGNED"] },
          pickupDate: { $gte: startOfToday() },
        }),
      ]);

    const current = summarize(periodBookings.filter((b) => b.createdAt >= start));
    const previous = summarize(periodBookings.filter((b) => b.createdAt < start));

    /* ---------- FLEET ---------- */
    const onTripIds = new Set(startedTrips.map((t) => String(t.cab)));
    const isActive = (c) => c.isActive !== false;

    const fleet = {
      total: cabs.length,
      inactive: cabs.filter((c) => !isActive(c)).length,
      onTrip: cabs.filter((c) => isActive(c) && onTripIds.has(String(c._id))).length,
      available: cabs.filter((c) => isActive(c) && !onTripIds.has(String(c._id))).length,
    };

    const typeMap = {};
    cabs.forEach((c) => {
      const key = c.cabType || "Cab";
      const t = (typeMap[key] ||= { cabType: key, count: 0, available: 0, baseSum: 0, baseN: 0, kmSum: 0, kmN: 0 });
      t.count += 1;
      if (isActive(c) && !onTripIds.has(String(c._id))) t.available += 1;
      if (Number(c.price) > 0) { t.baseSum += Number(c.price); t.baseN += 1; }
      if (Number(c.pricePerKm) > 0) { t.kmSum += Number(c.pricePerKm); t.kmN += 1; }
    });
    const byType = Object.values(typeMap).map((t) => ({
      cabType: t.cabType,
      count: t.count,
      available: t.available,
      avgBaseFare: t.baseN ? Math.round(t.baseSum / t.baseN) : 0,
      avgPerKm: t.kmN ? Math.round((t.kmSum / t.kmN) * 100) / 100 : 0,
    }));

    /* ---------- DRIVERS ---------- */
    const drivers = cabs
      .map((c) => ({ c, d: cabDriverOf(c) }))
      .filter(({ d }) => d.name)
      .map(({ c, d }) => ({
        cabId: c._id,
        vehicleNumber: c.vehicleNumber || "",
        cabType: c.cabType || "",
        driverName: d.name,
        driverPhone: d.phone,
        driverLicenseNumber: d.license,
        onTrip: onTripIds.has(String(c._id)),
      }));

    /* ---------- RECENT BOOKINGS ---------- */
    const cabMap = new Map(cabs.map((c) => [String(c._id), c]));
    const recentBookings = recent.map((b) => {
      const cab = cabMap.get(String(b.cab)) || {};
      return {
        _id: b._id,
        bookingId: b.bookingId,
        customerName: b.customer?.name || "",
        fromCity: b.fromCity || "",
        toCity: b.toCity || "",
        pickupDate: b.pickupDate,
        pickupTime: b.pickupTime,
        status: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        vehicleNumber: cab.vehicleNumber || "",
        cabType: cab.cabType || "",
        driverName: b.driverDetails?.name || cabDriverOf(cab).name || "",
        fare: b.pricing?.totalAmount || 0,
        createdAt: b.createdAt,
      };
    });

    return ok(res, {
      range,
      kpis: {
        revenue: current.revenue,
        revenueChange: pctChange(current.revenue, previous.revenue),
        rides: current.rides,
        ridesChange: pctChange(current.rides, previous.rides),
        completed: current.completed,
        cancelled: current.cancelled,
        avgFare: current.paidCount ? Math.round(current.revenue / current.paidCount) : 0,
        pendingBookings: pendingCount,
        upcomingTrips: upcomingCount,
      },
      fleet,
      byType,
      drivers,
      recentBookings,
    });
  } catch (error) {
    return serverError(res, "getVendorDashboard", error);
  }
};