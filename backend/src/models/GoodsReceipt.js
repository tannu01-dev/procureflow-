
const mongoose = require("mongoose");

const goodsReceiptItemSchema = new mongoose.Schema(
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
    orderedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    receivedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    acceptedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    damagedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    rejectedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    conditionNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  { _id: false }
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    grnNumber: {
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
      index: true,
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    deliveryReference: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    items: {
      type: [goodsReceiptItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "A goods receipt must contain at least one item.",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

goodsReceiptSchema.index(
  { companyId: 1, grnNumber: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.GoodsReceipt ||
  mongoose.model("GoodsReceipt", goodsReceiptSchema);
