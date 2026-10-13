
const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { requireCompany } = require("../middleware/authorize");

const {
  createRFQ,
  listRFQs,
  getRFQ,
  updateRFQStatus,
} = require("../controllers/rfqController");

const {
  listQuotations,
  createQuotation,
  compareQuotations,
} = require("../controllers/quotationController");

const router = express.Router();

router.use(authenticate);
router.use(requireCompany);

router.get("/", listRFQs);
router.post("/", createRFQ);

router.get("/:id", getRFQ);
router.patch("/:id/status", updateRFQStatus);

router.get("/:rfqId/quotations", listQuotations);
router.post("/:rfqId/quotations", createQuotation);
router.get("/:rfqId/compare", compareQuotations);

module.exports = router;
