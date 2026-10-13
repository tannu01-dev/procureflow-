const mongoose = require("mongoose");

const Invoice = require("../models/Invoice");
const PurchaseOrder = require("../models/PurchaseOrder");
const GoodsReceipt = require("../models/GoodsReceipt");

const MANAGER_ROLES = [
  "company_admin",
  "procurement_manager",
];

const FINANCE_ROLES = [
  "company_admin",
  "finance",
];

const MATCH_TOLERANCE = 0.02;

const roundMoney = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function getCompanyId(req) {
  const value = req.user?.companyId;

  return value?._id
    ? String(value._id)
    : String(value || "");
}

function getUserId(req) {
  return req.user?._id || req.user?.id;
}

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function sendError(res, status, message) {
  return res.status(status).json({ message });
}

function isFinance(req) {
  return FINANCE_ROLES.includes(req.user?.role);
}

function canManageInvoices(req) {
  return [
    ...MANAGER_ROLES,
    "finance",
  ].includes(req.user?.role);
}

function populateInvoice(query) {
  return query
    .populate("purchaseOrderId", "poNumber status totalAmount currency items")
    .populate("vendorId", "name email category")
    .populate("createdBy", "name email")
    .populate("reviewedBy", "name email");
}

function validDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

// GET /api/invoices
exports.listInvoices = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return sendError(res, 400, "Company information is missing.");
    }

    const filter = { companyId };

    if (req.query.status) {
      const statuses = [
        "draft",
        "matched",
        "discrepancy",
        "approved",
        "rejected",
      ];

      if (!statuses.includes(req.query.status)) {
        return sendError(res, 400, "Invalid invoice status.");
      }

      filter.status = req.query.status;
    }

    if (req.query.purchaseOrderId) {
      if (!validId(req.query.purchaseOrderId)) {
        return sendError(res, 400, "Invalid purchase order ID.");
      }

      filter.purchaseOrderId = req.query.purchaseOrderId;
    }

    const invoices = await populateInvoice(
      Invoice.find(filter).sort({ createdAt: -1 })
    );

    return res.json({ invoices });
  } catch (error) {
    next(error);
  }
};

// GET /api/invoices/:id
exports.getInvoice = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid invoice ID.");
    }

    const invoice = await populateInvoice(
      Invoice.findOne({ _id: id, companyId })
    );

    if (!invoice) {
      return sendError(res, 404, "Invoice not found.");
    }

    return res.json({ invoice });
  } catch (error) {
    next(error);
  }
};

// POST /api/invoices
exports.createInvoice = async (req, res, next) => {
  try {
    if (!canManageInvoices(req)) {
      return sendError(
        res,
        403,
        "You are not allowed to record invoices."
      );
    }

    const companyId = getCompanyId(req);
    const userId = getUserId(req);

    const {
      invoiceNumber,
      purchaseOrderId,
      invoiceDate,
      dueDate,
      items,
      notes = "",
    } = req.body;

    if (!companyId || !userId) {
      return sendError(
        res,
        400,
        "Company or user information is missing."
      );
    }

    if (!String(invoiceNumber || "").trim()) {
      return sendError(res, 400, "Invoice number is required.");
    }

    if (!validId(purchaseOrderId)) {
      return sendError(res, 400, "A valid purchase order is required.");
    }

    const parsedInvoiceDate = validDate(invoiceDate);

    if (!parsedInvoiceDate) {
      return sendError(res, 400, "A valid invoice date is required.");
    }

    let parsedDueDate = null;

    if (dueDate) {
      parsedDueDate = validDate(dueDate);

      if (!parsedDueDate) {
        return sendError(res, 400, "Invalid invoice due date.");
      }

      if (parsedDueDate < parsedInvoiceDate) {
        return sendError(
          res,
          400,
          "Due date cannot be earlier than the invoice date."
        );
      }
    }

    const order = await PurchaseOrder.findOne({
      _id: purchaseOrderId,
      companyId,
    });

    if (!order) {
      return sendError(res, 404, "Purchase order not found.");
    }

    if (
      ["draft", "cancelled"].includes(order.status)
    ) {
      return sendError(
        res,
        400,
        "An invoice can only be recorded against an issued, acknowledged or received purchase order."
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(
        res,
        400,
        "Add at least one invoice item."
      );
    }

    const seenIndexes = new Set();

    const normalizedItems = items.map((item) => {
      const itemIndex = Number(item.itemIndex);
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate ?? 0);

      if (
        !Number.isInteger(itemIndex) ||
        itemIndex < 0 ||
        itemIndex >= order.items.length
      ) {
        throw new Error("An invoice item refers to an invalid PO item.");
      }

      if (seenIndexes.has(itemIndex)) {
        throw new Error(
          "Each PO item can appear only once in an invoice."
        );
      }

      seenIndexes.add(itemIndex);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100
      ) {
        throw new Error(
          "Invoice quantities, prices or tax rates are invalid."
        );
      }

      const poItem = order.items[itemIndex];
      const lineSubtotal = roundMoney(quantity * unitPrice);
      const taxAmount = roundMoney(
        (lineSubtotal * taxRate) / 100
      );

      return {
        itemIndex,
        itemName: poItem.name,
        quantity,
        unitPrice,
        taxRate,
        lineSubtotal,
        taxAmount,
        lineTotal: roundMoney(lineSubtotal + taxAmount),
      };
    });

    const subtotal = roundMoney(
      normalizedItems.reduce(
        (sum, item) => sum + item.lineSubtotal,
        0
      )
    );

    const taxAmount = roundMoney(
      normalizedItems.reduce(
        (sum, item) => sum + item.taxAmount,
        0
      )
    );

    const totalAmount = roundMoney(subtotal + taxAmount);

    const invoice = await Invoice.create({
      invoiceNumber: String(invoiceNumber).trim(),
      companyId,
      purchaseOrderId: order._id,
      vendorId: order.vendorId,
      invoiceDate: parsedInvoiceDate,
      dueDate: parsedDueDate,
      items: normalizedItems,
      subtotal,
      taxAmount,
      totalAmount,
      currency: order.currency || "INR",
      status: "draft",
      notes: String(notes).trim(),
      createdBy: userId,
      matchResult: {
        matched: false,
        issues: [],
        itemResults: [],
      },
    });

    const result = await populateInvoice(
      Invoice.findById(invoice._id)
    );

    return res.status(201).json({
      message: "Invoice recorded. Run three-way matching before approval.",
      invoice: result,
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "An invoice with this number already exists for your company."
      );
    }

    if (
      error.message?.includes("invoice item") ||
      error.message?.includes("Invoice quantities") ||
      error.message?.includes("Each PO item")
    ) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};

// POST /api/invoices/:id/match
exports.matchInvoice = async (req, res, next) => {
  try {
    if (!canManageInvoices(req)) {
      return sendError(
        res,
        403,
        "You are not allowed to run invoice matching."
      );
    }

    const companyId = getCompanyId(req);
    const { id } = req.params;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid invoice ID.");
    }

    const invoice = await Invoice.findOne({
      _id: id,
      companyId,
    });

    if (!invoice) {
      return sendError(res, 404, "Invoice not found.");
    }

    if (["approved", "rejected"].includes(invoice.status)) {
      return sendError(
        res,
        400,
        "An approved or rejected invoice cannot be re-matched."
      );
    }

    const order = await PurchaseOrder.findOne({
      _id: invoice.purchaseOrderId,
      companyId,
    });

    if (!order) {
      return sendError(res, 404, "Related purchase order not found.");
    }

    const receipts = await GoodsReceipt.find({
      companyId,
      purchaseOrderId: order._id,
    }).lean();

    const acceptedByIndex = new Map();

    for (const receipt of receipts) {
      for (const receivedItem of receipt.items || []) {
        const index = Number(receivedItem.itemIndex);

        acceptedByIndex.set(
          index,
          (acceptedByIndex.get(index) || 0) +
            Number(receivedItem.acceptedQuantity || 0)
        );
      }
    }

    const previousInvoices = await Invoice.find({
      companyId,
      purchaseOrderId: order._id,
      _id: { $ne: invoice._id },
      status: { $in: ["matched", "discrepancy", "approved"] },
    }).select("items status");

    const previouslyInvoicedByIndex = new Map();

    for (const previousInvoice of previousInvoices) {
      for (const item of previousInvoice.items || []) {
        const index = Number(item.itemIndex);

        previouslyInvoicedByIndex.set(
          index,
          (previouslyInvoicedByIndex.get(index) || 0) +
            Number(item.quantity || 0)
        );
      }
    }

    const issues = [];
    const itemResults = [];

    if (receipts.length === 0) {
      issues.push(
        "No Goods Receipt Note exists for this purchase order."
      );
    }

    for (const invoiceItem of invoice.items) {
      const index = Number(invoiceItem.itemIndex);
      const poItem = order.items[index];

      if (!poItem) {
        issues.push(
          `Invoice item ${invoiceItem.itemName} does not match a PO item.`
        );
        continue;
      }

      const orderedQuantity = Number(poItem.quantity || 0);
      const acceptedQuantity = roundMoney(
        acceptedByIndex.get(index) || 0
      );
      const previouslyInvoicedQuantity = roundMoney(
        previouslyInvoicedByIndex.get(index) || 0
      );

      const availableToInvoiceQuantity = Math.max(
        0,
        roundMoney(
          acceptedQuantity - previouslyInvoicedQuantity
        )
      );

      const invoiceQuantity = Number(invoiceItem.quantity || 0);
      const invoiceUnitPrice = Number(invoiceItem.unitPrice || 0);
      const poUnitPrice = Number(poItem.unitPrice || 0);
      const invoiceTaxRate = Number(invoiceItem.taxRate || 0);
      const poTaxRate = Number(poItem.taxRate || 0);

      const quantityMatched =
        invoiceQuantity <= orderedQuantity + MATCH_TOLERANCE;

      const receiptMatched =
        invoiceQuantity <= availableToInvoiceQuantity + MATCH_TOLERANCE;

      const priceMatched =
        Math.abs(invoiceUnitPrice - poUnitPrice) <= MATCH_TOLERANCE;

      const taxMatched =
        Math.abs(invoiceTaxRate - poTaxRate) <= MATCH_TOLERANCE;

      if (!quantityMatched) {
        issues.push(
          `${invoiceItem.itemName}: invoice quantity exceeds the PO quantity.`
        );
      }

      if (!receiptMatched) {
        issues.push(
          `${invoiceItem.itemName}: invoiced quantity exceeds accepted goods available after previous invoices.`
        );
      }

      if (!priceMatched) {
        issues.push(
          `${invoiceItem.itemName}: invoice unit price does not match the PO price.`
        );
      }

      if (!taxMatched) {
        issues.push(
          `${invoiceItem.itemName}: invoice tax rate does not match the PO tax rate.`
        );
      }

      itemResults.push({
        itemIndex: index,
        itemName: invoiceItem.itemName,
        invoiceQuantity,
        orderedQuantity,
        acceptedQuantity,
        previouslyInvoicedQuantity,
        availableToInvoiceQuantity,
        invoiceUnitPrice,
        poUnitPrice,
        quantityMatched,
        priceMatched,
        receiptMatched,
      });
    }

    const expectedSubtotal = roundMoney(
      invoice.items.reduce((sum, invoiceItem) => {
        const poItem = order.items[invoiceItem.itemIndex];

        return sum +
          Number(invoiceItem.quantity) *
          Number(poItem?.unitPrice || 0);
      }, 0)
    );

    const expectedTax = roundMoney(
      invoice.items.reduce((sum, invoiceItem) => {
        const poItem = order.items[invoiceItem.itemIndex];
        const base = Number(invoiceItem.quantity) *
          Number(poItem?.unitPrice || 0);

        return sum + (base * Number(poItem?.taxRate || 0)) / 100;
      }, 0)
    );

    const expectedTotal = roundMoney(
      expectedSubtotal + expectedTax
    );

    if (
      Math.abs(invoice.subtotal - expectedSubtotal) >
        MATCH_TOLERANCE ||
      Math.abs(invoice.taxAmount - expectedTax) >
        MATCH_TOLERANCE ||
      Math.abs(invoice.totalAmount - expectedTotal) >
        MATCH_TOLERANCE
    ) {
      issues.push(
        "Invoice subtotal, tax or total differs from the PO-based expected amount."
      );
    }

    if (invoice.items.length === 0) {
      issues.push("The invoice contains no items.");
    }

    const matched = issues.length === 0;

    invoice.status = matched ? "matched" : "discrepancy";
    invoice.matchResult = {
      matched,
      checkedAt: new Date(),
      issues,
      itemResults,
    };

    await invoice.save();

    const result = await populateInvoice(
      Invoice.findById(invoice._id)
    );

    return res.json({
      message: matched
        ? "Three-way matching passed. Invoice is ready for finance review."
        : "Discrepancies found. Review the matching results before approval.",
      invoice: result,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/invoices/:id/status
exports.updateInvoiceStatus = async (req, res, next) => {
  try {
    if (!isFinance(req)) {
      return sendError(
        res,
        403,
        "Only finance users or company admins can approve or reject invoices."
      );
    }

    const companyId = getCompanyId(req);
    const userId = getUserId(req);
    const { id } = req.params;
    const { status, rejectionReason = "" } = req.body;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid invoice ID.");
    }

    if (!["approved", "rejected"].includes(status)) {
      return sendError(
        res,
        400,
        "Status must be approved or rejected."
      );
    }

    const invoice = await Invoice.findOne({
      _id: id,
      companyId,
    });

    if (!invoice) {
      return sendError(res, 404, "Invoice not found.");
    }

    if (invoice.status === "approved" || invoice.status === "rejected") {
      return sendError(
        res,
        400,
        "This invoice has already been approved or rejected."
      );
    }

    if (status === "approved" && invoice.status !== "matched") {
      return sendError(
        res,
        400,
        "Only invoices that pass three-way matching can be approved."
      );
    }

    if (status === "rejected" && !String(rejectionReason).trim()) {
      return sendError(
        res,
        400,
        "Provide a rejection reason."
      );
    }

    invoice.status = status;
    invoice.reviewedBy = userId;
    invoice.reviewedAt = new Date();
    invoice.rejectionReason =
      status === "rejected"
        ? String(rejectionReason).trim()
        : "";

    await invoice.save();

    const result = await populateInvoice(
      Invoice.findById(invoice._id)
    );

    return res.json({
      message:
        status === "approved"
          ? "Invoice approved successfully. Payment can be handled in Phase 11."
          : "Invoice rejected successfully.",
      invoice: result,
    });
  } catch (error) {
    next(error);
  }
};