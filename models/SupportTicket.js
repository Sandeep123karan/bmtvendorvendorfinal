
const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    category: {
      type: String,
      enum: [
        "Account & Profile",
        "Bookings",
        "Payments",
        "Property",
        "Technical Issue",
        "Other",
      ],
      required: true,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      default: "Open",
      index: true,
    },

    adminReply: {
      type: String,
      default: "",
      maxlength: 5000,
    },

    repliedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

supportTicketSchema.pre("validate", function () {
  if (!this.ticketNumber && this._id) {
    this.ticketNumber = `BMT-${this._id.toString().slice(-8).toUpperCase()}`;
  }
});

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
