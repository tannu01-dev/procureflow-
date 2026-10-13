
const mongoose = require("mongoose");
const GoodsReceipt = require("../models/GoodsReceipt");
const PurchaseOrder = require("../models/PurchaseOrder");

const RECEIPT_ROLES = [
  "company_admin",
  "procurement_manager",
  "requester",
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

function makeGRNNumber() {
  return `GRN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

exports.listGoodsReceipts = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        message: "Your account is not linked to a company.",
      });
    }

    const filter = { companyId };

    if (req.query.purchaseOrderId) {
      if (!validId(req.query.purchaseOrderId)) {
        return res.status(400).json({
          message: "Invalid purchase order ID.",
        });
      }

      filter.purchaseOrderId = req.query.purchaseOrderId;
    }

    const goodsReceipts = await GoodsReceipt.find(filter)
      .populate("purchaseOrderId", "poNumber status totalAmount currency")
      .populate("vendorId", "name email")
      .populate("receivedBy", "name email")
      .sort({ receivedAt: -1 })
      .lean();

    return res.json({
      count: goodsReceipts.length,
      goodsReceipts,
    });
  } catch (error) {
    next(error);
  }
};

exports.getGoodsReceipt = async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);

    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid GRN ID.",
      });
    }

    const goodsReceipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      companyId,
    })
      .populate("purchaseOrderId", "poNumber status totalAmount currency")
      .populate("vendorId", "name email")
      .populate("receivedBy", "name email");

    if (!goodsReceipt) {
      return res.status(404).json({
        message: "Goods receipt not found.",
      });
    }

    return res.json({ goodsReceipt });
  } catch (error) {
    next(error);
  }
};

exports.createGoodsReceipt = async (req, res, next) => {
  let purchaseOrderId;

  try {
    const companyId = getCompanyId(req);
    const userId = getUserId(req);

    if (!companyId || !userId) {
      return res.status(400).json({
        message: "Company or user information is missing.",
      });
    }

    purchaseOrderId = req.body.purchaseOrderId;

    if (!purchaseOrderId || !validId(purchaseOrderId)) {
      return res.status(400).json({
        message: "Select a valid purchase order.",
      });
    }

    if (!Array.isArray(req.body.items) || !req.body.items.length) {
      return res.status(400).json({
        message: "Enter at least one delivered item.",
      });
    }

    // Serialises receipt creation for the same PO in this process.
    // For multi-instance deployments, use a database transaction or
    // atomic reservation strategy as well.
    const order = await PurchaseOrder.findOne({
      _id: purchaseOrderId,
      companyId,
    });

    if (!order) {
      return res.status(404).json({
        message: "Purchase order not found.",
      });
    }

    if (
      !["issued", "acknowledged", "partially_received"].includes(
        order.status
      )
    ) {
      return res.status(400).json({
        message:
          "Only issued or in-progress purchase orders can receive goods.",
      });
    }

    const priorReceipts = await GoodsReceipt.find({
      companyId,
      purchaseOrderId: order._id,
    }).lean();

    const alreadyReceived = new Map();

    for (const receipt of priorReceipts) {
      for (const item of receipt.items) {
        const index = Number(item.itemIndex);
        alreadyReceived.set(
          index,
          (alreadyReceived.get(index) || 0) +
            Number(item.receivedQuantity || 0)
        );
      }
    }

    const seenIndices = new Set();
    const receiptItems = [];

    for (const submitted of req.body.items) {
      const index = Number(submitted.itemIndex);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= order.items.length ||
        seenIndices.has(index)
      ) {
        return res.status(400).json({
          message: "An item selection is invalid or duplicated.",
        });
      }

      seenIndices.add(index);

      const poItem = order.items[index];
      const receivedQuantity = numberValue(submitted.receivedQuantity);
      const damagedQuantity = numberValue(submitted.damagedQuantity || 0);
      const rejectedQuantity = numberValue(submitted.rejectedQuantity || 0);
      const acceptedQuantity = numberValue(submitted.acceptedQuantity);

      if (
        !Number.isFinite(receivedQuantity) ||
        !Number.isFinite(damagedQuantity) ||
        !Number.isFinite(rejectedQuantity) ||
        !Number.isFinite(acceptedQuantity) ||
        receivedQuantity <= 0 ||
        damagedQuantity < 0 ||
        rejectedQuantity < 0 ||
        acceptedQuantity < 0
      ) {
        return res.status(400).json({
          message: `Enter valid quantities for ${poItem.name}.`,
        });
      }

      const quantityTotal =
        acceptedQuantity + damagedQuantity + rejectedQuantity;

      if (Math.abs(quantityTotal - receivedQuantity) > 0.0001) {
        return res.status(400).json({
          message:
            `For ${poItem.name}, accepted + damaged + rejected ` +
            "quantities must equal the received quantity.",
        });
      }

      const previouslyReceived = alreadyReceived.get(index) || 0;
      const remaining = Number(poItem.quantity) - previouslyReceived;

      if (receivedQuantity > remaining + 0.0001) {
        return res.status(400).json({
          message:
            `Cannot receive ${receivedQuantity} units of ${poItem.name}. ` +
            `${remaining} unit(s) remain on this PO.`,
        });
      }

      receiptItems.push({
        itemIndex: index,
        itemName: poItem.name,
        orderedQuantity: Number(poItem.quantity),
        receivedQuantity,
        acceptedQuantity,
        damagedQuantity,
        rejectedQuantity,
        conditionNotes:
          typeof submitted.conditionNotes === "string"
            ? submitted.conditionNotes.trim().slice(0, 1000)
            : "",
      });
    }

    const receivedAt = req.body.receivedAt
      ? new Date(req.body.receivedAt)
      : new Date();

    if (Number.isNaN(receivedAt.getTime())) {
      return res.status(400).json({
        message: "Receipt date is invalid.",
      });
    }

    if (receivedAt > new Date()) {
      return res.status(400).json({
        message: "Receipt date cannot be in the future.",
      });
    }

    const grn = await GoodsReceipt.create({
      grnNumber: makeGRNNumber(),
      companyId,
      purchaseOrderId: order._id,
      vendorId: order.vendorId,
      receivedAt,
      deliveryReference:
        typeof req.body.deliveryReference === "string"
          ? req.body.deliveryReference.trim().slice(0, 200)
          : "",
      items: receiptItems,
      notes:
        typeof req.body.notes === "string"
          ? req.body.notes.trim().slice(0, 2000)
          : "",
      receivedBy: userId,
    });

    // Recalculate cumulative received quantities after saving the GRN.
    const allReceipts = await GoodsReceipt.find({
      companyId,
      purchaseOrderId: order._id,
    }).lean();

    const cumulative = new Map();

    for (const receipt of allReceipts) {
      for (const item of receipt.items) {
        const index = Number(item.itemIndex);
        cumulative.set(
          index,
          (cumulative.get(index) || 0) +
            Number(item.receivedQuantity || 0)
        );
      }
    }

    const fullyReceived = order.items.every((item, index) => {
      return (
        (cumulative.get(index) || 0) >=
        Number(item.quantity) - 0.0001
      );
    });

    const hasAnyReceived = cumulative.size > 0;

    if (fullyReceived) {
      order.status = "received";
    } else if (hasAnyReceived) {
      order.status = "partially_received";
    }

    if (fullyReceived || hasAnyReceived) {
      order.statusHistory.push({
        status: order.status,
        changedBy: userId,
        note: `Goods receipt recorded: ${grn.grnNumber}`,
      });

      await order.save();
    }

    const populatedGRN = await GoodsReceipt.findById(grn._id)
      .populate("purchaseOrderId", "poNumber status")
      .populate("vendorId", "name email")
      .populate("receivedBy", "name email");

    return res.status(201).json({
      message: "Goods receipt recorded successfully.",
      goodsReceipt: populatedGRN,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A duplicate GRN number was detected. Please retry.",
      });
    }

    next(error);
  }
};
