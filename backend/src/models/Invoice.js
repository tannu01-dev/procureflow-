const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    itemIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
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
    lineSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const matchResultSchema = new mongoose.Schema(
  {
    matched: {
      type: Boolean,
      default: false,
    },
    checkedAt: {
      type: Date,
      default: null,
    },
    issues: {
      type: [String],
      default: [],
    },
    itemResults: [
      {
        itemIndex: Number,
        itemName: String,
        invoiceQuantity: Number,
        orderedQuantity: Number,
        acceptedQuantity: Number,
        previouslyInvoicedQuantity: Number,
        availableToInvoiceQuantity: Number,
        invoiceUnitPrice: Number,
        poUnitPrice: Number,
        quantityMatched: Boolean,
        priceMatched: Boolean,
        receiptMatched: Boolean,
      },
    ],
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    invoiceDate: {
      type: Date,
      required: true,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "An invoice must contain at least one item.",
      },
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
      default: "INR",
      uppercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "matched",
        "discrepancy",
        "approved",
        "rejected",
      ],
      default: "draft",
      index: true,
    },

    matchResult: {
      type: matchResultSchema,
      default: () => ({}),
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

invoiceSchema.index(
  { companyId: 1, invoiceNumber: 1 },
  { unique: true }
);

invoiceSchema.index({
  companyId: 1,
  purchaseOrderId: 1,
  status: 1,
});

module.exports = mongoose.model("Invoice", invoiceSchema);