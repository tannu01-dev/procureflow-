
const express = require("express");
const router = express.Router();

const {
  listInvoices,
  getInvoice,
  createInvoice,
  matchInvoice,
  updateInvoiceStatus,
} = require("../controllers/invoiceController");

const { authenticate } = require("../middleware/authMiddleware");
const { requireCompany } = require("../middleware/authorize");

router.use(authenticate);
router.use(requireCompany);

router.get("/", listInvoices);
router.post("/", createInvoice);
router.get("/:id", getInvoice);
router.post("/:id/match", matchInvoice);
router.patch("/:id/status", updateInvoiceStatus);

module.exports = router;