const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorName: { type: String, trim: true, maxlength: 100, default: "Unknown user" },
    actorEmail: { type: String, trim: true, maxlength: 254, default: "" },
    actorRole: { type: String, trim: true, maxlength: 50, default: "unknown" },
    action: { type: String, required: true, trim: true, maxlength: 180, index: true },
    method: { type: String, required: true, trim: true, maxlength: 10 },
    path: { type: String, required: true, trim: true, maxlength: 300 },
    statusCode: { type: Number, required: true, min: 100, max: 599 },
    severity: { type: String, enum: ["info", "medium", "high", "critical"], default: "info", index: true },
    outcome: { type: String, enum: ["success", "failure"], required: true, index: true },
    message: { type: String, trim: true, maxlength: 300, default: "" },
    ipAddress: { type: String, trim: true, maxlength: 80, default: "" },
    userAgent: { type: String, trim: true, maxlength: 300, default: "" },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

auditLogSchema.index({ companyId: 1, occurredAt: -1 });
auditLogSchema.index({ companyId: 1, severity: 1, occurredAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
