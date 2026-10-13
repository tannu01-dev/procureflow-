
const express = require("express");
const controller = require("../controllers/companyController");
const { authenticate } = require("../middleware/authMiddleware");
const {
  allowRoles,
  allowPermissions,
  requireCompany,
} = require("../middleware/authorize");
const { ROLES, PERMISSIONS } = require("../config/roles");

const router = express.Router();

router.use(authenticate);

// A logged-in user without a company can create their workspace.
router.post("/", controller.createCompany);

// All routes below this line require an existing company.
router.use(requireCompany);

router.get(
  "/me",
  allowPermissions(PERMISSIONS.COMPANY_READ),
  controller.getCompany
);

router.patch(
  "/me",
  allowRoles(ROLES.COMPANY_ADMIN),
  controller.updateCompany
);

router.get(
  "/members",
  allowPermissions(PERMISSIONS.USERS_READ),
  controller.listMembers
);

router.post(
  "/members",
  allowRoles(ROLES.COMPANY_ADMIN),
  controller.createMember
);

router.patch(
  "/members/:userId/role",
  allowRoles(ROLES.COMPANY_ADMIN),
  controller.updateMemberRole
);

router.patch(
  "/members/:userId/status",
  allowRoles(ROLES.COMPANY_ADMIN),
  controller.updateMemberStatus
);

module.exports = router;
