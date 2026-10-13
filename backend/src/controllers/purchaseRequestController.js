const mongoose = require("mongoose");
const PurchaseRequest = require("../models/PurchaseRequest");

function getUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function getCompanyId(req) {
  return req.user?.companyId?._id || req.user?.companyId;
}

function isSameId(first, second) {
  return Boolean(first && second && String(first) === String(second));
}

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Add at least one item to the request.");
  }

  if (items.length > 100) {
    throw new Error("A request cannot contain more than 100 items.");
  }

  return items.map((item) => {
    const name = String(item.name || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    if (!name) {
      throw new Error("Every item must have a name.");
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Enter a valid quantity for "${name}".`);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Enter a valid unit price for "${name}".`);
    }

    return {
      name,
      description: String(item.description || "").trim(),
      quantity,
      unit: String(item.unit || "piece").trim() || "piece",
      unitPrice,
    };
  });
}

function normalizeRequestBody(body) {
  const title = String(body.title || "").trim();

  if (title.length < 3 || title.length > 150) {
    throw new Error("Title must contain between 3 and 150 characters.");
  }

  const allowedPriorities = ["low", "normal", "high", "urgent"];
  const priority = body.priority || "normal";

  if (!allowedPriorities.includes(priority)) {
    throw new Error("Invalid priority.");
  }

  let neededBy = null;

  if (body.neededBy) {
    neededBy = new Date(body.neededBy);

    if (Number.isNaN(neededBy.getTime())) {
      throw new Error("Enter a valid required-by date.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (neededBy < today) {
      throw new Error("Required-by date cannot be in the past.");
    }
  }

  return {
    title,
    description: String(body.description || "").trim(),
    department: String(body.department || "").trim(),
    priority,
    neededBy,
    items: normalizeItems(body.items),
  };
}

function handleValidationError(res, error) {
  if (
    error.message &&
    !error.name?.includes("Validation") &&
    !error.name?.includes("Cast")
  ) {
    return sendError(res, 400, error.message);
  }

  return sendError(res, 400, error.message || "Invalid request data.");
}

function canReadAllRequests(role) {
  return [
    "company_admin",
    "procurement_manager",
    "approver",
    "finance",
    "auditor",
  ].includes(role);
}

// POST /api/purchase-requests
async function createPurchaseRequest(req, res, next) {
  try {
    const userId = getUserId(req);
    const companyId = getCompanyId(req);

    if (!userId || !companyId) {
      return sendError(res, 401, "User or company information is missing.");
    }

    const data = normalizeRequestBody(req.body);

    const purchaseRequest = await PurchaseRequest.create({
      ...data,
      companyId,
      requestedBy: userId,
      status: "draft",
    });

    return res.status(201).json({
      success: true,
      message: "Purchase request saved as draft.",
      request: purchaseRequest,
    });
  } catch (error) {
    if (error.name === "ValidationError" || !error.name === "Error" || !error.name) {
      return handleValidationError(res, error);
    }
    return next(error);
  }
}

// GET /api/purchase-requests
async function listPurchaseRequests(req, res, next) {
  try {
    const companyId = getCompanyId(req);
    const userId = getUserId(req);
    const role = req.user?.role;

    const filter = { companyId };

    // Requesters see only their own requests.
    if (!canReadAllRequests(role)) {
      filter.requestedBy = userId;
    }

    if (req.query.status) {
      const allowedStatuses = [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "cancelled",
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return sendError(res, 400, "Invalid status filter.");
      }

      filter.status = req.query.status;
    }

    const requests = await PurchaseRequest.find(filter)
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 })
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

// GET /api/purchase-requests/:id
async function getPurchaseRequest(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid purchase request ID.");
    }

    const purchaseRequest = await PurchaseRequest.findOne({
      _id: id,
      companyId: getCompanyId(req),
    }).populate("requestedBy", "name email");

    if (!purchaseRequest) {
      return sendError(res, 404, "Purchase request not found.");
    }

    if (
      !canReadAllRequests(req.user?.role) &&
      !isSameId(purchaseRequest.requestedBy?._id || purchaseRequest.requestedBy, getUserId(req))
    ) {
      return sendError(res, 403, "You cannot view this purchase request.");
    }

    return res.json({
      success: true,
      request: purchaseRequest,
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/purchase-requests/:id
async function updatePurchaseRequest(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid purchase request ID.");
    }

    const purchaseRequest = await PurchaseRequest.findOne({
      _id: id,
      companyId: getCompanyId(req),
    });

    if (!purchaseRequest) {
      return sendError(res, 404, "Purchase request not found.");
    }

    if (!isSameId(purchaseRequest.requestedBy, getUserId(req))) {
      return sendError(res, 403, "Only the request creator can edit this request.");
    }

    if (purchaseRequest.status !== "draft") {
      return sendError(res, 400, "Only draft requests can be edited.");
    }

    const data = normalizeRequestBody(req.body);

    Object.assign(purchaseRequest, data);
    await purchaseRequest.save();

    return res.json({
      success: true,
      message: "Purchase request updated.",
      request: purchaseRequest,
    });
  } catch (error) {
    if (
  error.name === "ValidationError" ||
  error.name === "Error" ||
  !error.name
) {
      return handleValidationError(res, error);
    }
    return next(error);
  }
}

// POST /api/purchase-requests/:id/submit
async function submitPurchaseRequest(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid purchase request ID.");
    }

    const purchaseRequest = await PurchaseRequest.findOne({
      _id: id,
      companyId: getCompanyId(req),
    });

    if (!purchaseRequest) {
      return sendError(res, 404, "Purchase request not found.");
    }

    if (!isSameId(purchaseRequest.requestedBy, getUserId(req))) {
      return sendError(res, 403, "Only the request creator can submit this request.");
    }

    if (purchaseRequest.status !== "draft") {
      return sendError(res, 400, "Only draft requests can be submitted.");
    }

    purchaseRequest.status = "submitted";
    purchaseRequest.approvalHistory.push({
  action: "submitted",
  actor: getUserId(req),
  comment: "",
  timestamp: new Date(),
});
    purchaseRequest.submittedAt = new Date();

    await purchaseRequest.save();

    return res.json({
      success: true,
      message: "Purchase request submitted for approval.",
      request: purchaseRequest,
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/purchase-requests/:id/cancel
async function cancelPurchaseRequest(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid purchase request ID.");
    }

    const purchaseRequest = await PurchaseRequest.findOne({
      _id: id,
      companyId: getCompanyId(req),
    });

    if (!purchaseRequest) {
      return sendError(res, 404, "Purchase request not found.");
    }

    if (!isSameId(purchaseRequest.requestedBy, getUserId(req))) {
      return sendError(res, 403, "Only the request creator can cancel this request.");
    }

    if (!["draft", "submitted"].includes(purchaseRequest.status)) {
      return sendError(res, 400, "This request can no longer be cancelled.");
    }

    purchaseRequest.status = "cancelled";
    await purchaseRequest.save();

    return res.json({
      success: true,
      message: "Purchase request cancelled.",
      request: purchaseRequest,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createPurchaseRequest,
  listPurchaseRequests,
  getPurchaseRequest,
  updatePurchaseRequest,
  submitPurchaseRequest,
  cancelPurchaseRequest,
};