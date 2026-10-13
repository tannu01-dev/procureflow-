
const { ROLE_PERMISSIONS } = require("../config/roles");

function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}

function allowPermissions(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const grantedPermissions = ROLE_PERMISSIONS[req.user.role] || [];
    const hasPermission = requiredPermissions.every((permission) =>
      grantedPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Your role does not have the required permission.",
      });
    }

    next();
  };
}

function requireCompany(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!req.user.companyId) {
    return res.status(403).json({
      success: false,
      message: "Create or join a company workspace first.",
      code: "COMPANY_REQUIRED",
    });
  }

  next();
}

module.exports = { allowRoles, allowPermissions, requireCompany };
