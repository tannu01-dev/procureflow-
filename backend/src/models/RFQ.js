
const mongoose = require("mongoose");
const crypto = require("crypto");

const rfqItemSchema = new mongoose.Schema(
  {
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
  },
  { _id: false }
);

const rfqSchema = new mongoose.Schema(
  {
    rfqNumber: {
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
    purchaseRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRequest",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    items: {
      type: [rfqItemSchema],
      validate: {
        validator: (items) =>
          Array.isArray(items) && items.length > 0 && items.length <= 100,
        message: "An RFQ must contain between 1 and 100 items.",
      },
    },
    vendorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        required: true,
      },
    ],
    issueDate: {
      type: Date,
      default: Date.now,
    },
    deadline: {
      type: Date,
      required: true,
    },
    terms: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "published", "closed", "cancelled"],
      default: "draft",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

rfqSchema.pre("validate", function assignRFQNumber() {
  if (!this.rfqNumber) {
    this.rfqNumber =
      `RFQ-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
});

rfqSchema.index({ companyId: 1, createdAt: -1 });
rfqSchema.index({ companyId: 1, status: 1 });

module.exports =
  mongoose.models.RFQ || mongoose.model("RFQ", rfqSchema);
