
const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { requireCompany } = require("../middleware/authorize");

const controller = require("../controllers/approvalController");

const router = express.Router();

router.use(authenticate);
router.use(requireCompany);

router.get("/", controller.listApprovalQueue);
router.get("/:id", controller.getApprovalDetails);
router.post("/:id/approve", controller.approveRequest);
router.post("/:id/reject", controller.rejectRequest);

module.exports = router;
