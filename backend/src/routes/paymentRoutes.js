const express = require("express");
const router = express.Router();

const {
  listPayments,
  getPaymentSummary,
  createPayment,
  updatePaymentStatus,
} = require("../controllers/paymentController");

const { authenticate } = require("../middleware/authMiddleware");
const { requireCompany } = require("../middleware/authorize");

router.use(authenticate);
router.use(requireCompany);

router.get("/", listPayments);
router.get("/summary", getPaymentSummary);
router.post("/", createPayment);
router.patch("/:id/status", updatePaymentStatus);

module.exports = router;