
const mongoose = require("mongoose");

const quotationItemSchema = new mongoose.Schema(
  {
    rfqItemName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryDays: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    quotationNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    items: {
      type: [quotationItemSchema],
      validate: (items) => Array.isArray(items) && items.length > 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      enum: ["INR", "USD", "EUR", "GBP"],
      default: "INR",
    },
    deliveryDays: {
      type: Number,
      required: true,
      min: 0,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    paymentTerms: {
      type: String,
      enum: ["immediate", "net_15", "net_30", "net_45", "net_60"],
      default: "net_30",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: ["submitted", "withdrawn"],
      default: "submitted",
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

quotationSchema.index(
  { companyId: 1, rfqId: 1, vendorId: 1 },
  { unique: true }
);

quotationSchema.index({ companyId: 1, rfqId: 1, totalAmount: 1 });

module.exports =
  mongoose.models.Quotation ||
  mongoose.model("Quotation", quotationSchema);
