const AuditLog = require("../models/AuditLog");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function classifySeverity(statusCode, path) {
  const normalizedPath = String(path || "").toLowerCase();
  if (statusCode >= 500) return "critical";
  if (statusCode >= 400) return "high";
  if (
    normalizedPath.includes("/status") ||
    normalizedPath.includes("approve") ||
    normalizedPath.includes("reject") ||
    normalizedPath.includes("payment") ||
    normalizedPath.includes("role") ||
    normalizedPath.includes("cancel") ||
    normalizedPath.includes("delete")
  ) return "medium";
  return "info";
}

function makeAction(method, path) {
  const cleanPath = String(path || "").split("?")[0].replace(/\/{2,}/g, "/");
  const segments = cleanPath.split("/").filter(Boolean);
  const moduleName = segments[1] || "api";
  const actionName = method === "POST" ? "CREATE_OR_SUBMIT" :
    method === "PATCH" || method === "PUT" ? "UPDATE" : "DELETE";
  return `${moduleName.toUpperCase()}.${actionName}`.slice(0, 180);
}

/**
 * Records authenticated write requests after the response completes. Request bodies,
 * tokens, passwords, and query strings are deliberately never stored.
 */
function auditLogger(req, res, next) {
  if (!MUTATING_METHODS.has(req.method) || !req.path.startsWith("/api/")) {
    return next();
  }

  res.once("finish", () => {
    const user = req.user;
    if (!user || !user.companyId) return;

    const statusCode = Number(res.statusCode) || 500;
    const severity = classifySeverity(statusCode, req.originalUrl || req.path);
    const outcome = statusCode >= 400 ? "failure" : "success";
    const path = String(req.originalUrl || req.path).split("?")[0].slice(0, 300);

    AuditLog.create({
      companyId: user.companyId,
      actorId: user._id,
      actorName: user.name || "Unknown user",
      actorEmail: user.email || "",
      actorRole: user.role || "unknown",
      action: makeAction(req.method, path),
      method: req.method,
      path,
      statusCode,
      severity,
      outcome,
      message: outcome === "failure"
        ? `Write request returned HTTP ${statusCode}.`
        : `Authenticated ${req.method} request completed.`,
      ipAddress: String(req.ip || req.socket?.remoteAddress || "").slice(0, 80),
      userAgent: String(req.get("user-agent") || "").slice(0, 300),
      occurredAt: new Date(),
    }).catch((error) => {
      // Audit persistence must not crash an already completed API response.
      console.error("Audit log write failed:", error.message);
    });
  });

  next();
}

module.exports = { auditLogger };
