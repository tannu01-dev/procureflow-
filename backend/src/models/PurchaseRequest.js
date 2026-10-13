
const mongoose = require("mongoose");
const crypto = require("crypto");

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: "",
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.01,
  },
  unit: {
    type: String,
    trim: true,
    maxlength: 30,
    default: "piece",
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  lineTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const approvalHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ["submitted", "approved", "rejected", "cancelled"],
    required: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: "",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      unique: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    department: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    neededBy: {
      type: Date,
      default: null,
    },
    items: {
      type: [itemSchema],
      validate: {
        validator: (items) =>
          Array.isArray(items) && items.length > 0 && items.length <= 100,
        message: "A request must contain between 1 and 100 items.",
      },
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    approvalHistory: {
      type: [approvalHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

purchaseRequestSchema.pre("validate", function calculateTotals() {
  if (!this.requestNumber) {
    this.requestNumber = `PR-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;
  }

  let total = 0;

  for (const item of this.items || []) {
    item.lineTotal = Number(
      (Number(item.quantity) * Number(item.unitPrice)).toFixed(2)
    );
    total += item.lineTotal;
  }

  this.subtotal = Number(total.toFixed(2));
  this.totalAmount = this.subtotal;
});

purchaseRequestSchema.index({ companyId: 1, createdAt: -1 });
purchaseRequestSchema.index({ companyId: 1, status: 1 });

module.exports =
  mongoose.models.PurchaseRequest ||
  mongoose.model("PurchaseRequest", purchaseRequestSchema);
