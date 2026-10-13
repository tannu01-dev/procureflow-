
const express = require("express");

const {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
} = require("../controllers/purchaseOrderController");

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
  listPurchaseOrders
);

router.post(
  "/",
  allowRoles("company_admin", "procurement_manager"),
  createPurchaseOrder
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
  getPurchaseOrder
);

router.patch(
  "/:id/status",
  allowRoles("company_admin", "procurement_manager"),
  updatePurchaseOrderStatus
);

module.exports = router;