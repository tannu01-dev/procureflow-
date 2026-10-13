
const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { requireCompany } = require("../middleware/authorize");

const {
  createVendor,
  listVendors,
  getVendor,
  updateVendor,
  updateVendorStatus,
} = require("../controllers/vendorController");

const router = express.Router();

router.use(authenticate);
router.use(requireCompany);

router.get("/", listVendors);
router.post("/", createVendor);
router.get("/:id", getVendor);
router.patch("/:id", updateVendor);
router.patch("/:id/status", updateVendorStatus);

module.exports = router;
