
const mongoose = require("mongoose");
const PurchaseRequest = require("../models/PurchaseRequest");

const APPROVER_ROLES = [
  "company_admin",
  "procurement_manager",
  "approver",
];

function userId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function companyId(req) {
  return req.user?.companyId?._id || req.user?.companyId;
}

function sameId(a, b) {
  return Boolean(a && b && String(a) === String(b));
}

function errorResponse(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function ensureApprover(req, res) {
  if (!APPROVER_ROLES.includes(req.user?.role)) {
    errorResponse(res, 403, "You are not allowed to approve requests.");
    return false;
  }

  return true;
}

// GET /api/approvals
async function listApprovalQueue(req, res, next) {
  try {
    if (!ensureApprover(req, res)) return;

    const filter = {
      companyId: companyId(req),
      status: "submitted",
    };

    const requests = await PurchaseRequest.find(filter)
      .populate("requestedBy", "name email")
      .sort({ submittedAt: 1, createdAt: 1 })
      .limit(200)
      .lean();

    return res.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/approvals/:id
async function getApprovalDetails(req, res, next) {
  try {
    if (!ensureApprover(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, 400, "Invalid purchase request ID.");
    }

    const request = await PurchaseRequest.findOne({
      _id: req.params.id,
      companyId: companyId(req),
    }).populate("requestedBy", "name email");

    if (!request) {
      return errorResponse(res, 404, "Purchase request not found.");
    }

    return res.json({
      success: true,
      request,
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/approvals/:id/approve
async function approveRequest(req, res, next) {
  try {
    if (!ensureApprover(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, 400, "Invalid purchase request ID.");
    }

    const comment = String(req.body.comment || "").trim();

    if (comment.length > 1000) {
      return errorResponse(res, 400, "Comment cannot exceed 1000 characters.");
    }

    const request = await PurchaseRequest.findOne({
      _id: req.params.id,
      companyId: companyId(req),
    });

    if (!request) {
      return errorResponse(res, 404, "Purchase request not found.");
    }

    if (sameId(request.requestedBy, userId(req))) {
      return errorResponse(
        res,
        403,
        "You cannot approve your own purchase request."
      );
    }

    if (request.status !== "submitted") {
      return errorResponse(
        res,
        409,
        "Only submitted requests can be approved."
      );
    }

    // Conditional update prevents two approvers from approving
    // the same submitted request simultaneously.
    const updated = await PurchaseRequest.findOneAndUpdate(
      {
        _id: request._id,
        companyId: companyId(req),
        status: "submitted",
        requestedBy: { $ne: userId(req) },
      },
      {
        $set: {
          status: "approved",
          approvedAt: new Date(),
        },
        $push: {
          approvalHistory: {
            action: "approved",
            actor: userId(req),
            comment,
            timestamp: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    ).populate("requestedBy", "name email");

    if (!updated) {
      return errorResponse(
        res,
        409,
        "This request was already processed. Refresh the queue."
      );
    }

    return res.json({
      success: true,
      message: "Purchase request approved successfully.",
      request: updated,
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/approvals/:id/reject
async function rejectRequest(req, res, next) {
  try {
    if (!ensureApprover(req, res)) return;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, 400, "Invalid purchase request ID.");
    }

    const comment = String(req.body.comment || "").trim();

    if (!comment) {
      return errorResponse(
        res,
        400,
        "A rejection reason is required."
      );
    }

    if (comment.length > 1000) {
      return errorResponse(res, 400, "Reason cannot exceed 1000 characters.");
    }

    const request = await PurchaseRequest.findOne({
      _id: req.params.id,
      companyId: companyId(req),
    });

    if (!request) {
      return errorResponse(res, 404, "Purchase request not found.");
    }

    if (sameId(request.requestedBy, userId(req))) {
      return errorResponse(
        res,
        403,
        "You cannot reject your own purchase request."
      );
    }

    if (request.status !== "submitted") {
      return errorResponse(
        res,
        409,
        "Only submitted requests can be rejected."
      );
    }

    const updated = await PurchaseRequest.findOneAndUpdate(
      {
        _id: request._id,
        companyId: companyId(req),
        status: "submitted",
        requestedBy: { $ne: userId(req) },
      },
      {
        $set: {
          status: "rejected",
          rejectedAt: new Date(),
        },
        $push: {
          approvalHistory: {
            action: "rejected",
            actor: userId(req),
            comment,
            timestamp: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    ).populate("requestedBy", "name email");

    if (!updated) {
      return errorResponse(
        res,
        409,
        "This request was already processed. Refresh the queue."
      );
    }

    return res.json({
      success: true,
      message: "Purchase request rejected.",
      request: updated,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listApprovalQueue,
  getApprovalDetails,
  approveRequest,
  rejectRequest,
};
