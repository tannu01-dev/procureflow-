const mongoose = require("mongoose");

const PurchaseOrder = require("../models/PurchaseOrder");
const Quotation = require("../models/Quotation");
const RFQ = require("../models/RFQ");

const MANAGER_ROLES = [
  "company_admin",
  "procurement_manager",
];

function getCompanyId(req) {
  return req.user?.companyId?._id ||
    req.user?.companyId ||
    null;
}

function getUserId(req) {
  return req.user?._id || req.user?.id || null;
}

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function calculateTotals(items) {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const taxRate = Number(item.taxRate || 0);

    const lineSubtotal = quantity * unitPrice;
    const lineTax = lineSubtotal * (taxRate / 100);

    subtotal += lineSubtotal;
    taxAmount += lineTax;
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    totalAmount: Number((subtotal + taxAmount).toFixed(2)),
  };
}

function makePONumber() {
  const timestamp = Date.now().toString();
  const random = Math.floor(1000 + Math.random() * 9000);

  return `PO-${timestamp}-${random}`;
}

exports.listPurchaseOrders = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        message: "Your account is not linked to a company.",
      });
    }

    const filter = { companyId };

    if (req.query.status) {
      const allowedStatuses = [
        "draft",
        "issued",
        "acknowledged",
        "partially_received",
        "received",
        "cancelled",
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          message: "Invalid purchase order status.",
        });
      }

      filter.status = req.query.status;
    }

    const purchaseOrders = await PurchaseOrder.find(filter)
      .populate("vendorId", "name email category status")
      .populate("rfqId", "title")
      .populate("purchaseRequestId", "requestNumber title")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      count: purchaseOrders.length,
      purchaseOrders,
    });
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseOrder = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid purchase order ID.",
      });
    }

    const purchaseOrder = await PurchaseOrder.findOne({
      _id: req.params.id,
      companyId,
    })
      .populate("vendorId", "name email category status")
      .populate("rfqId", "title deadline")
      .populate("quotationId")
      .populate("purchaseRequestId", "requestNumber title")
      .populate("createdBy", "name email")
      .populate("statusHistory.changedBy", "name email");

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
      });
    }

    return res.json({ purchaseOrder });
  } catch (error) {
    next(error);
  }
};

exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId = getUserId(req);

    if (!companyId || !userId) {
      return res.status(400).json({
        message: "Company or user information is missing.",
      });
    }

    const { quotationId, expectedDeliveryDate, notes } = req.body;

    if (!quotationId || !validId(quotationId)) {
      return res.status(400).json({
        message: "Select a valid quotation.",
      });
    }

    const quotation = await Quotation.findOne({
      _id: quotationId,
      companyId,
      status: "submitted",
    }).lean();

    if (!quotation) {
      return res.status(404).json({
        message: "Submitted quotation not found in your company.",
      });
    }

    const existingOrder = await PurchaseOrder.findOne({
      companyId,
      quotationId: quotation._id,
    }).lean();

    if (existingOrder) {
      return res.status(409).json({
        message: "A purchase order already exists for this quotation.",
        purchaseOrder: existingOrder,
      });
    }

    const rfq = await RFQ.findOne({
      _id: quotation.rfqId,
      companyId,
    }).lean();

    if (!rfq) {
      return res.status(404).json({
        message: "The quotation's RFQ was not found.",
      });
    }

    const invitedVendorIds = (rfq.vendorIds || []).map((id) =>
      String(id?._id || id)
    );

    if (!invitedVendorIds.includes(String(quotation.vendorId))) {
      return res.status(400).json({
        message: "The quotation vendor is not invited to this RFQ.",
      });
    }

    if (!quotation.items?.length) {
      return res.status(400).json({
        message: "The selected quotation contains no items.",
      });
    }

    const items = quotation.items.map((item) => ({
      name: item.rfqItemName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate || 0),
      lineTotal: Number(
        (
          Number(item.quantity) *
          Number(item.unitPrice) *
          (1 + Number(item.taxRate || 0) / 100)
        ).toFixed(2)
      ),
    }));

    const totals = calculateTotals(items);

    const deliveryDate = expectedDeliveryDate
      ? new Date(expectedDeliveryDate)
      : null;

    if (deliveryDate && Number.isNaN(deliveryDate.getTime())) {
      return res.status(400).json({
        message: "Expected delivery date is invalid.",
      });
    }

    if (deliveryDate && deliveryDate < new Date()) {
      return res.status(400).json({
        message: "Expected delivery date cannot be in the past.",
      });
    }

    const purchaseOrder = await PurchaseOrder.create({
      poNumber: makePONumber(),
      companyId,
      rfqId: quotation.rfqId,
      quotationId: quotation._id,
      purchaseRequestId: rfq.purchaseRequestId,
      vendorId: quotation.vendorId,
      items,
      ...totals,
      currency: quotation.currency || "INR",
      paymentTerms: quotation.paymentTerms || "net_30",
      deliveryDays: Number(quotation.deliveryDays || 0),
      expectedDeliveryDate: deliveryDate,
      notes: typeof notes === "string" ? notes.trim() : "",
      status: "draft",
      createdBy: userId,
      statusHistory: [
        {
          status: "draft",
          changedBy: userId,
          note: "Purchase order created.",
        },
      ],
    });

    const populatedOrder = await PurchaseOrder.findById(
      purchaseOrder._id
    )
      .populate("vendorId", "name email category")
      .populate("rfqId", "title")
      .populate("purchaseRequestId", "requestNumber title");

    return res.status(201).json({
      message: "Purchase order created successfully.",
      purchaseOrder: populatedOrder,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "A purchase order already exists for this quotation or PO number.",
      });
    }

    next(error);
  }
};

exports.updatePurchaseOrderStatus = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userId = getUserId(req);
    const { status, note } = req.body;

    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid purchase order ID.",
      });
    }

    const allowedStatuses = [
      "issued",
      "acknowledged",
      "partially_received",
      "received",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid target status.",
      });
    }

    const purchaseOrder = await PurchaseOrder.findOne({
      _id: req.params.id,
      companyId,
    });

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
      });
    }

    const transitions = {
      draft: ["issued", "cancelled"],
      issued: ["acknowledged", "partially_received", "received", "cancelled"],
      acknowledged: ["partially_received", "received", "cancelled"],
      partially_received: ["received", "cancelled"],
      received: [],
      cancelled: [],
    };

    if (!transitions[purchaseOrder.status]?.includes(status)) {
      return res.status(400).json({
        message: `Cannot change status from ${purchaseOrder.status} to ${status}.`,
      });
    }

    if (
      status === "issued" &&
      !MANAGER_ROLES.includes(req.user?.role)
    ) {
      return res.status(403).json({
        message: "Only company admins and procurement managers can issue POs.",
      });
    }

    if (
      ["acknowledged", "partially_received", "received", "cancelled"].includes(status) &&
      !MANAGER_ROLES.includes(req.user?.role)
    ) {
      return res.status(403).json({
        message: "You do not have permission to change this PO status.",
      });
    }

    purchaseOrder.status = status;

    if (status === "issued") {
      purchaseOrder.issuedAt = new Date();
    }

    purchaseOrder.statusHistory.push({
      status,
      changedBy: userId,
      note: typeof note === "string" ? note.trim().slice(0, 1000) : "",
    });

    await purchaseOrder.save();

    return res.json({
      message: `Purchase order status changed to ${status}.`,
      purchaseOrder,
    });
  } catch (error) {
    next(error);
  }
};