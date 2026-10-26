
const mongoose = require("mongoose");
const SupportTicket = require("../models/SupportTicket");

function getVendorId(req) {
  return (
    req.vendor?._id ||
    req.vendor?.id ||
    req.user?.vendorId ||
    req.user?._id ||
    req.user?.id
  );
}

// CREATE SUPPORT TICKET
exports.createTicket = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication required",
      });
    }

    const { subject, category, priority, description } = req.body;

    if (!subject?.trim() || !description?.trim() || !category) {
      return res.status(400).json({
        success: false,
        message: "Subject, category and description are required",
      });
    }

    const ticket = await SupportTicket.create({
      vendorId,
      subject: subject.trim(),
      category,
      priority: priority || "Medium",
      description: description.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      ticket,
    });
  } catch (error) {
    console.error("Create support ticket:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create support ticket",
    });
  }
};

// GET LOGGED-IN VENDOR'S TICKETS
exports.getMyTickets = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication required",
      });
    }

    const tickets = await SupportTicket.find({ vendorId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    console.error("Get support tickets:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch support tickets",
    });
  }
};

// GET ONE TICKET BELONGING TO THE VENDOR
exports.getTicketById = async (req, res) => {
  try {
    const vendorId = getVendorId(req);
    const { id } = req.params;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return res.status(401).json({
        success: false,
        message: "Valid vendor authentication required",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const ticket = await SupportTicket.findOne({
      _id: id,
      vendorId,
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("Get support ticket:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch support ticket",
    });
  }
};

module.exports = {
  createTicket: exports.createTicket,
  getMyTickets: exports.getMyTickets,
  getTicketById: exports.getTicketById,
};
