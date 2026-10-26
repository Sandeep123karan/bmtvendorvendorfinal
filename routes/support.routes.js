
const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");

const {
  createTicket,
  getMyTickets,
  getTicketById,
} = require("../controllers/support.controller");

router.use(protect);

router.post("/", createTicket);
router.get("/", getMyTickets);
router.get("/:id", getTicketById);

module.exports = router;
