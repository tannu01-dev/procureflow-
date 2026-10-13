const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

function companyIdOf(req) {
  return req.user?.companyId?._id || req.user?.companyId;
}

function buildFilter(req) {
  const filter = { companyId: companyIdOf(req) };
  const { severity, outcome, action, from, to, search } = req.query;

  if (["info", "medium", "high", "critical"].includes(String(severity))) {
    filter.severity = severity;
  }
  if (["success", "failure"].includes(String(outcome))) filter.outcome = outcome;
  if (typeof action === "string" && action.trim()) {
    filter.action = { $regex: action.trim().slice(0, 80), $options: "i" };
  }

  const dateFilter = {};
  if (from && !Number.isNaN(Date.parse(from))) dateFilter.$gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }
  if (Object.keys(dateFilter).length) filter.occurredAt = dateFilter;

  if (typeof search === "string" && search.trim()) {
    const safeSearch = search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { actorName: { $regex: safeSearch, $options: "i" } },
      { actorEmail: { $regex: safeSearch, $options: "i" } },
      { action: { $regex: safeSearch, $options: "i" } },
      { path: { $regex: safeSearch, $options: "i" } },
      { message: { $regex: safeSearch, $options: "i" } },
    ];
  }
  return filter;
}

async function listAuditLogs(req, res, next) {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit)) : DEFAULT_LIMIT;
    const parsedPage = Number.parseInt(req.query.page, 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const filter = buildFilter(req);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ occurredAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("actorId actorName actorEmail actorRole action method path statusCode severity outcome message ipAddress userAgent occurredAt")
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ success: true, logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

async function getAuditSummary(req, res, next) {
  try {
    const companyId = companyIdOf(req);
    if (!mongoose.isValidObjectId(companyId)) {
      return res.status(400).json({ success: false, message: "A valid company workspace is required." });
    }

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    const base = { companyId, occurredAt: { $gte: start, $lte: now } };

    const [total, failed, highRisk, critical, latest, bySeverity] = await Promise.all([
      AuditLog.countDocuments(base),
      AuditLog.countDocuments({ ...base, outcome: "failure" }),
      AuditLog.countDocuments({ ...base, severity: "high" }),
      AuditLog.countDocuments({ ...base, severity: "critical" }),
      AuditLog.find({ ...base, severity: { $in: ["high", "critical"] } })
        .sort({ occurredAt: -1 }).limit(5)
        .select("actorName actorRole action path statusCode severity occurredAt message").lean(),
      AuditLog.aggregate([
        { $match: base },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
    ]);

    const severityCounts = { info: 0, medium: 0, high: 0, critical: 0 };
    for (const row of bySeverity) severityCounts[row._id] = row.count;

    res.json({
      success: true,
      summary: { periodDays: 30, totalEvents: total, failedEvents: failed, highRiskEvents: highRisk, criticalEvents: critical, severityCounts, recentHighRisk: latest },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listAuditLogs, getAuditSummary };
