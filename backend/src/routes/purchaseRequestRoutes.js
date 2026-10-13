const express = require("express");
const controller = require("../controllers/purchaseRequestController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles, requireCompany } = require("../middleware/authorize");

const router = express.Router();

const requestReaders = [
  "company_admin",
  "procurement_manager",
  "requester",
  "approver",
  "finance",
  "auditor",
];

router.use(authenticate);
router.use(requireCompany);

router.post(
  "/",
  allowRoles("company_admin", "requester"),
  controller.createPurchaseRequest
);

router.get(
  "/",
  allowRoles(...requestReaders),
  controller.listPurchaseRequests
);

router.get(
  "/:id",
  allowRoles(...requestReaders),
  controller.getPurchaseRequest
);

router.patch(
  "/:id",
  allowRoles("company_admin", "requester"),
  controller.updatePurchaseRequest
);

router.post(
  "/:id/submit",
  allowRoles("company_admin", "requester"),
  controller.submitPurchaseRequest
);

router.post(
  "/:id/cancel",
  allowRoles("company_admin", "requester"),
  controller.cancelPurchaseRequest
);

module.exports = router;