const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const { requireCompany, allowRoles } = require("../middleware/authorize");
const { listAuditLogs, getAuditSummary } = require("../controllers/auditLogController");

const AUDIT_ROLES = ["company_admin", "procurement_manager", "finance", "auditor"];
router.use(authenticate, requireCompany, allowRoles(...AUDIT_ROLES));
router.get("/summary", getAuditSummary);
router.get("/", listAuditLogs);

module.exports = router;
