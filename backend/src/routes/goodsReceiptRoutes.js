
const express = require("express");

const {
  listGoodsReceipts,
  getGoodsReceipt,
  createGoodsReceipt,
} = require("../controllers/goodsReceiptController");

const { authenticate } = require("../middleware/authMiddleware");
const {
  allowRoles,
  requireCompany,
} = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate, requireCompany);

router.get(
  "/",
  allowRoles(
    "company_admin",
    "procurement_manager",
    "requester",
    "approver",
    "finance",
    "auditor"
  ),
  listGoodsReceipts
);

router.get(
  "/:id",
  allowRoles(
    "company_admin",
    "procurement_manager",
    "requester",
    "approver",
    "finance",
    "auditor"
  ),
  getGoodsReceipt
);

router.post(
  "/",
  allowRoles("company_admin", "procurement_manager", "requester"),
  createGoodsReceipt
);

module.exports = router;
