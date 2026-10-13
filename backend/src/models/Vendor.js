
const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    vendorCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      required: true,
    },
    website: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      required: true,
    },
    taxId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: "",
    },
    address: {
      street: { type: String, trim: true, maxlength: 200, default: "" },
      city: { type: String, trim: true, maxlength: 100, default: "" },
      state: { type: String, trim: true, maxlength: 100, default: "" },
      postalCode: { type: String, trim: true, maxlength: 20, default: "" },
      country: { type: String, trim: true, maxlength: 100, default: "India" },
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
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

vendorSchema.index(
  { companyId: 1, email: 1 },
  { unique: true }
);

vendorSchema.index({ companyId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Vendor ||
  mongoose.model("Vendor", vendorSchema);
