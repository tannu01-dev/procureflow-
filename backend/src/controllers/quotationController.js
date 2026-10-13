
const mongoose = require("mongoose");
const RFQ = require("../models/RFQ");
const Vendor = require("../models/Vendor");
const Quotation = require("../models/Quotation");

const MANAGE_ROLES = ["company_admin", "procurement_manager"];

function companyId(req) {
  return req.user?.companyId?._id || req.user?.companyId;
}

function userId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function canManage(req, res) {
  if (!MANAGE_ROLES.includes(req.user?.role)) {
    res.status(403).json({
      success: false,
      message: "You are not allowed to manage quotations.",
    });
    return false;
  }
  return true;
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function listQuotations(req, res, next) {
  try {
    if (!canManage(req, res)) return;

    if (!validId(req.params.rfqId)) {
      return fail(res, 400, "Invalid RFQ ID.");
    }

    const rfq = await RFQ.findOne({
      _id: req.params.rfqId,
      companyId: companyId(req),
    }).select("_id");

    if (!rfq) return fail(res, 404, "RFQ not found.");

    const quotations = await Quotation.find({
      companyId: companyId(req),
      rfqId: rfq._id,
      status: "submitted",
    })
      .populate("vendorId", "name email category")
      .sort({ totalAmount: 1, deliveryDays: 1 })
      .lean();

    return res.json({
      success: true,
      count: quotations.length,
      quotations,
    });
  } catch (error) {
    return next(error);
  }
}

async function createQuotation(req, res, next) {
  try {
    if (!canManage(req, res)) return;

    const { rfqId } = req.params;
    const {
      vendorId,
      quotationNumber = "",
      items,
      deliveryDays,
      validUntil,
      paymentTerms = "net_30",
      currency = "INR",
      notes = "",
    } = req.body;

    if (!validId(rfqId) || !validId(vendorId)) {
      return fail(res, 400, "Valid RFQ and vendor IDs are required.");
    }

    const rfq = await RFQ.findOne({
      _id: rfqId,
      companyId: companyId(req),
    });

    if (!rfq) return fail(res, 404, "RFQ not found.");

    if (rfq.status !== "published") {
      return fail(res, 409, "Quotations can only be recorded for published RFQs.");
    }

    if (rfq.deadline <= new Date()) {
      return fail(res, 400, "The RFQ submission deadline has passed.");
    }

    if (!rfq.vendorIds.some((id) => String(id) === String(vendorId))) {
      return fail(res, 400, "This vendor was not invited to the RFQ.");
    }

    const vendor = await Vendor.findOne({
      _id: vendorId,
      companyId: companyId(req),
      status: "active",
    });

    if (!vendor) return fail(res, 400, "Vendor is not active or was not found.");

    if (!Array.isArray(items) || items.length !== rfq.items.length) {
      return fail(res, 400, "A price must be provided for every RFQ item.");
    }

    if (
      !Number.isInteger(Number(deliveryDays)) ||
      Number(deliveryDays) < 0
    ) {
      return fail(res, 400, "Delivery days must be a non-negative integer.");
    }

    const expiry = new Date(validUntil);
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
      return fail(res, 400, "Quotation validity date must be in the future.");
    }

    const allowedPaymentTerms = [
      "immediate", "net_15", "net_30", "net_45", "net_60",
    ];

    if (!allowedPaymentTerms.includes(paymentTerms)) {
      return fail(res, 400, "Invalid payment terms.");
    }

    const allowedCurrencies = ["INR", "USD", "EUR", "GBP"];
    if (!allowedCurrencies.includes(currency)) {
      return fail(res, 400, "Unsupported currency.");
    }

    const quoteItems = [];
    let subtotal = 0;
    let taxAmount = 0;

    for (let i = 0; i < rfq.items.length; i += 1) {
      const source = rfq.items[i];
      const incoming = items[i];

      const quantity = Number(source.quantity);
      const unitPrice = Number(incoming.unitPrice);
      const taxRate = Number(incoming.taxRate ?? 0);
      const quoteQuantity = Number(incoming.quantity ?? quantity);

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100 ||
        !Number.isFinite(quoteQuantity) ||
        quoteQuantity !== quantity
      ) {
        return fail(
          res,
          400,
          `Invalid price, tax or quantity for item ${source.name}.`
        );
      }

      const lineSubtotal = Number((quantity * unitPrice).toFixed(2));
      const lineTax = Number((lineSubtotal * taxRate / 100).toFixed(2));
      const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

      subtotal += lineSubtotal;
      taxAmount += lineTax;

      quoteItems.push({
        rfqItemName: source.name,
        quantity,
        unitPrice,
        taxRate,
        lineTotal,
        deliveryDays: Number(deliveryDays),
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    taxAmount = Number(taxAmount.toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const quotation = await Quotation.create({
      companyId: companyId(req),
      rfqId: rfq._id,
      vendorId: vendor._id,
      quotationNumber: String(quotationNumber).trim(),
      items: quoteItems,
      subtotal,
      taxAmount,
      totalAmount,
      currency,
      deliveryDays: Number(deliveryDays),
      validUntil: expiry,
      paymentTerms,
      notes: String(notes).trim(),
      submittedBy: userId(req),
    });

    return res.status(201).json({
      success: true,
      message: "Quotation recorded successfully.",
      quotation,
    });
  } catch (error) {
    if (error.code === 11000) {
      return fail(
        res,
        409,
        "A quotation has already been recorded for this vendor and RFQ."
      );
    }
    return next(error);
  }
}

async function compareQuotations(req, res, next) {
  try {
    if (!canManage(req, res)) return;

    if (!validId(req.params.rfqId)) {
      return fail(res, 400, "Invalid RFQ ID.");
    }

    const rfq = await RFQ.findOne({
      _id: req.params.rfqId,
      companyId: companyId(req),
    })
      .populate("vendorIds", "name email category")
      .lean();

    if (!rfq) return fail(res, 404, "RFQ not found.");

    const quotations = await Quotation.find({
      companyId: companyId(req),
      rfqId: rfq._id,
      status: "submitted",
    })
      .populate("vendorId", "name email category")
      .sort({ totalAmount: 1, deliveryDays: 1 })
      .lean();

    const comparison = quotations.map((quote, index) => ({
      rank: index + 1,
      quotationId: quote._id,
      vendor: quote.vendorId,
      quotationNumber: quote.quotationNumber,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
      deliveryDays: quote.deliveryDays,
      validUntil: quote.validUntil,
      paymentTerms: quote.paymentTerms,
      notes: quote.notes,
      isLowestPrice: index === 0,
    }));

    return res.json({
      success: true,
      rfq: {
        _id: rfq._id,
        rfqNumber: rfq.rfqNumber,
        title: rfq.title,
        deadline: rfq.deadline,
        status: rfq.status,
      },
      invitedVendorCount: rfq.vendorIds.length,
      quotationCount: comparison.length,
      quotations: comparison,
      message:
        comparison.length === 0
          ? "No quotations have been recorded yet."
          : "Comparison is sorted by total amount, then delivery time.",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listQuotations,
  createQuotation,
  compareQuotations,
};
