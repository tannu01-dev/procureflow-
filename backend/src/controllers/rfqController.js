
const mongoose = require("mongoose");
const RFQ = require("../models/RFQ");
const Vendor = require("../models/Vendor");
const PurchaseRequest = require("../models/PurchaseRequest");
const Quotation = require("../models/Quotation");

const MANAGE_ROLES = ["company_admin", "procurement_manager"];

function getUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function getCompanyId(req) {
  return req.user?.companyId?._id || req.user?.companyId;
}

function canManage(req, res) {
  if (!MANAGE_ROLES.includes(req.user?.role)) {
    res.status(403).json({
      success: false,
      message: "Procurement manager permission is required.",
    });
    return false;
  }
  return true;
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

async function createRFQ(req, res, next) {
  try {
    if (!canManage(req, res)) return;

    const {
      purchaseRequestId,
      title,
      description = "",
      deadline,
      terms = "",
      vendorIds,
    } = req.body;

    if (
      !validId(purchaseRequestId) ||
      !title?.trim() ||
      !deadline ||
      !Array.isArray(vendorIds) ||
      vendorIds.length === 0
    ) {
      return fail(
        res,
        400,
        "Purchase request, title, deadline and at least one vendor are required."
      );
    }

    const deadlineDate = new Date(deadline);

    if (
      Number.isNaN(deadlineDate.getTime()) ||
      deadlineDate <= new Date()
    ) {
      return fail(res, 400, "RFQ deadline must be in the future.");
    }

    if (new Set(vendorIds.map(String)).size !== vendorIds.length) {
      return fail(res, 400, "Duplicate vendor IDs are not allowed.");
    }

    if (!vendorIds.every(validId)) {
      return fail(res, 400, "One or more vendor IDs are invalid.");
    }

    const company = getCompanyId(req);
    const user = getUserId(req);

    if (!company || !user) {
      return fail(res, 400, "Company or user identity is missing.");
    }

    const request = await PurchaseRequest.findOne({
      _id: purchaseRequestId,
      companyId: company,
      status: "approved",
    });

    if (!request) {
      return fail(
        res,
        400,
        "RFQ can only be created from an approved purchase request."
      );
    }

    const vendors = await Vendor.find({
      _id: { $in: vendorIds },
      companyId: company,
      status: "active",
    }).select("_id");

    if (vendors.length !== vendorIds.length) {
      return fail(
        res,
        400,
        "All selected vendors must be active and belong to your company."
      );
    }

    const rfq = await RFQ.create({
      companyId: company,
      purchaseRequestId: request._id,
      title: title.trim(),
      description: String(description).trim(),
      items: request.items.map((item) => ({
        name: item.name,
        description: item.description || "",
        quantity: item.quantity,
        unit: item.unit || "piece",
      })),
      vendorIds,
      deadline: deadlineDate,
      terms: String(terms).trim(),
      createdBy: user,
    });

    return res.status(201).json({
      success: true,
      message: "RFQ draft created successfully.",
      rfq,
    });
  } catch (error) {
    return next(error);
  }
}

async function listRFQs(req, res, next) {
  try {
    if (!canManage(req, res)) return;

    const filter = { companyId: getCompanyId(req) };

    if (req.query.status) {
      const allowed = ["draft", "published", "closed", "cancelled"];
      if (!allowed.includes(req.query.status)) {
        return fail(res, 400, "Invalid RFQ status.");
      }
      filter.status = req.query.status;
    }

    const rfqs = await RFQ.find(filter)
      .populate("purchaseRequestId", "requestNumber title totalAmount status")
      .populate("vendorIds", "name email category status")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    const rfqIds = rfqs.map((rfq) => rfq._id);

    const quoteCounts = await Quotation.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(String(getCompanyId(req))),
          rfqId: { $in: rfqIds },
          status: "submitted",
        },
      },
      { $group: { _id: "$rfqId", count: { $sum: 1 } } },
    ]);

    const counts = new Map(
      quoteCounts.map((item) => [String(item._id), item.count])
    );

    return res.json({
      success: true,
      count: rfqs.length,
      rfqs: rfqs.map((rfq) => ({
        ...rfq,
        quotationCount: counts.get(String(rfq._id)) || 0,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function getRFQ(req, res, next) {
  try {
    if (!canManage(req, res)) return;

    if (!validId(req.params.id)) {
      return fail(res, 400, "Invalid RFQ ID.");
    }

    const rfq = await RFQ.findOne({
      _id: req.params.id,
      companyId: getCompanyId(req),
    })
      .populate("purchaseRequestId", "requestNumber title totalAmount status")
      .populate("vendorIds", "name email category status")
      .lean();

    if (!rfq) return fail(res, 404, "RFQ not found.");

    return res.json({ success: true, rfq });
  } catch (error) {
    return next(error);
  }
}

async function updateRFQStatus(req, res, next) {
  try {
    if (!canManage(req, res)) return;

    if (!validId(req.params.id)) {
      return fail(res, 400, "Invalid RFQ ID.");
    }

    const { status } = req.body;
    if (!["published", "closed", "cancelled"].includes(status)) {
      return fail(res, 400, "Invalid RFQ status transition.");
    }

    const rfq = await RFQ.findOne({
      _id: req.params.id,
      companyId: getCompanyId(req),
    });

    if (!rfq) return fail(res, 404, "RFQ not found.");

    const allowedTransitions = {
      draft: ["published", "cancelled"],
      published: ["closed", "cancelled"],
      closed: [],
      cancelled: [],
    };

    if (!allowedTransitions[rfq.status]?.includes(status)) {
      return fail(
        res,
        409,
        `Cannot change RFQ from ${rfq.status} to ${status}.`
      );
    }

    if (status === "published" && rfq.deadline <= new Date()) {
      return fail(res, 400, "Cannot publish an RFQ with an expired deadline.");
    }

    rfq.status = status;
    await rfq.save();

    return res.json({
      success: true,
      message: `RFQ ${status} successfully.`,
      rfq,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createRFQ,
  listRFQs,
  getRFQ,
  updateRFQStatus,
};
