const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    paymentMethod: {
      type: String,
      enum: [
        "bank_transfer",
        "upi",
        "cheque",
        "card",
        "cash",
        "other",
      ],
      required: true,
    },

    paymentReference: {
      type: String,
      default: "",
      trim: true,
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["completed", "pending", "failed", "cancelled"],
      default: "completed",
      index: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          default: "",
        },
      },
    ],
  },
  { timestamps: true }
);

paymentSchema.index({ companyId: 1, invoiceId: 1, status: 1 });
paymentSchema.index({ companyId: 1, paymentDate: -1 });

module.exports = mongoose.model("Payment", paymentSchema);