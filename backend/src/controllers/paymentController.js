const crypto = require("crypto");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");

const FINANCE_ROLES = ["company_admin", "finance"];

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

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

function populatePayment(query) {
  return query
    .populate("invoiceId", "invoiceNumber totalAmount currency dueDate status")
    .populate("vendorId", "name email")
    .populate("createdBy", "name email");
}

async function getPaymentSummary(companyId, invoiceIds) {
  const rows = await Payment.aggregate([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(companyId),
        invoiceId: {
          $in: invoiceIds.map(
            (id) => new mongoose.Types.ObjectId(String(id))
          ),
        },
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$invoiceId",
        paidAmount: { $sum: "$amount" },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      roundMoney(row.paidAmount),
    ])
  );
}

// GET /api/payments
exports.listPayments = async (req, res, next) => {
  try {
    if (!isFinance(req)) {
      return sendError(
        res,
        403,
        "Only finance users and company admins can view payment records."
      );
    }

    const companyId = getCompanyId(req);

    if (!companyId) {
      return sendError(res, 400, "Company information is missing.");
    }

    const filter = { companyId };

    if (req.query.status) {
      const statuses = [
        "completed",
        "pending",
        "failed",
        "cancelled",
      ];

      if (!statuses.includes(req.query.status)) {
        return sendError(res, 400, "Invalid payment status.");
      }

      filter.status = req.query.status;
    }

    if (req.query.invoiceId) {
      if (!validId(req.query.invoiceId)) {
        return sendError(res, 400, "Invalid invoice ID.");
      }

      filter.invoiceId = req.query.invoiceId;
    }

    const payments = await populatePayment(
      Payment.find(filter).sort({ paymentDate: -1, createdAt: -1 })
    );

    return res.json({ payments });
  } catch (error) {
    next(error);
  }
};

// GET /api/payments/summary
exports.getPaymentSummary = async (req, res, next) => {
  try {
    if (!isFinance(req)) {
      return sendError(res, 403, "Finance access is required.");
    }

    const companyId = getCompanyId(req);

    const invoices = await Invoice.find({
      companyId,
      status: "approved",
    })
      .select("invoiceNumber vendorId totalAmount currency dueDate")
      .lean();

    const paidMap = await getPaymentSummary(
      companyId,
      invoices.map((invoice) => invoice._id)
    );

    const now = new Date();

    const summaryInvoices = invoices.map((invoice) => {
      const paidAmount = paidMap.get(String(invoice._id)) || 0;
      const outstandingAmount = roundMoney(
        Math.max(0, Number(invoice.totalAmount) - paidAmount)
      );

      const isOverdue =
        outstandingAmount > 0 &&
        invoice.dueDate &&
        new Date(invoice.dueDate) < now;

      return {
        ...invoice,
        paidAmount,
        outstandingAmount,
        paymentStatus:
          outstandingAmount <= 0
            ? "paid"
            : paidAmount > 0
              ? "partially_paid"
              : isOverdue
                ? "overdue"
                : "unpaid",
      };
    });

    const totals = summaryInvoices.reduce(
      (acc, invoice) => {
        acc.invoiceValue += Number(invoice.totalAmount || 0);
        acc.paidAmount += invoice.paidAmount;
        acc.outstandingAmount += invoice.outstandingAmount;

        if (invoice.paymentStatus === "paid") acc.paidInvoices += 1;
        if (invoice.paymentStatus === "partially_paid") {
          acc.partiallyPaidInvoices += 1;
        }
        if (invoice.paymentStatus === "unpaid") acc.unpaidInvoices += 1;
        if (invoice.paymentStatus === "overdue") acc.overdueInvoices += 1;

        return acc;
      },
      {
        invoiceValue: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        paidInvoices: 0,
        partiallyPaidInvoices: 0,
        unpaidInvoices: 0,
        overdueInvoices: 0,
      }
    );

    Object.keys(totals).forEach((key) => {
      if (key.endsWith("Amount") || key === "invoiceValue") {
        totals[key] = roundMoney(totals[key]);
      }
    });

    return res.json({
      summary: totals,
      invoices: summaryInvoices,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/payments
exports.createPayment = async (req, res, next) => {
  try {
    if (!isFinance(req)) {
      return sendError(
        res,
        403,
        "Only finance users and company admins can record payments."
      );
    }

    const companyId = getCompanyId(req);
    const userId = getUserId(req);

    const {
      invoiceId,
      amount,
      paymentMethod,
      paymentReference = "",
      paymentDate,
      status = "completed",
      notes = "",
    } = req.body;

    if (!companyId || !userId) {
      return sendError(res, 400, "Company or user information is missing.");
    }

    if (!validId(invoiceId)) {
      return sendError(res, 400, "A valid invoice ID is required.");
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return sendError(res, 400, "Payment amount must be greater than zero.");
    }

    const methods = [
      "bank_transfer",
      "upi",
      "cheque",
      "card",
      "cash",
      "other",
    ];

    if (!methods.includes(paymentMethod)) {
      return sendError(res, 400, "Select a valid payment method.");
    }

    const allowedStatuses = ["completed", "pending"];

    if (!allowedStatuses.includes(status)) {
      return sendError(
        res,
        400,
        "New payments can only be recorded as pending or completed."
      );
    }

    const parsedDate = paymentDate ? new Date(paymentDate) : new Date();

    if (Number.isNaN(parsedDate.getTime())) {
      return sendError(res, 400, "Invalid payment date.");
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      companyId,
    });

    if (!invoice) {
      return sendError(res, 404, "Invoice not found.");
    }

    if (invoice.status !== "approved") {
      return sendError(
        res,
        400,
        "Only approved invoices can receive payment records."
      );
    }

    const existingPayments = await Payment.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          invoiceId: invoice._id,
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$amount" },
        },
      },
    ]);

    const alreadyPaid = roundMoney(existingPayments[0]?.totalPaid || 0);
    const outstanding = roundMoney(
      Number(invoice.totalAmount) - alreadyPaid
    );

    if (outstanding <= 0) {
      return sendError(res, 400, "This invoice is already fully paid.");
    }

    if (
      status === "completed" &&
      paymentAmount > outstanding + 0.001
    ) {
      return sendError(
        res,
        400,
        `Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.`
      );
    }

    const paymentNumber = `PAY-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const payment = await Payment.create({
      paymentNumber,
      companyId,
      invoiceId: invoice._id,
      vendorId: invoice.vendorId,
      amount: roundMoney(paymentAmount),
      currency: invoice.currency || "INR",
      paymentMethod,
      paymentReference: String(paymentReference).trim(),
      paymentDate: parsedDate,
      status,
      notes: String(notes).trim(),
      createdBy: userId,
      statusHistory: [
        {
          status,
          changedBy: userId,
          note:
            status === "completed"
              ? "Payment recorded as completed by finance."
              : "Payment recorded as pending.",
        },
      ],
    });

    const result = await populatePayment(
      Payment.findById(payment._id)
    );

    return res.status(201).json({
      message:
        status === "completed"
          ? "Payment recorded successfully."
          : "Pending payment record created successfully.",
      payment: result,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/payments/:id/status
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    if (!isFinance(req)) {
      return sendError(res, 403, "Finance access is required.");
    }

    const companyId = getCompanyId(req);
    const userId = getUserId(req);
    const { id } = req.params;
    const { status, note = "" } = req.body;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid payment ID.");
    }

    if (!["completed", "failed", "cancelled"].includes(status)) {
      return sendError(
        res,
        400,
        "Status must be completed, failed or cancelled."
      );
    }

    const payment = await Payment.findOne({
      _id: id,
      companyId,
    });

    if (!payment) {
      return sendError(res, 404, "Payment not found.");
    }

    if (payment.status !== "pending") {
      return sendError(
        res,
        400,
        "Only pending payments can change status."
      );
    }

    if (status === "completed") {
      const invoice = await Invoice.findOne({
        _id: payment.invoiceId,
        companyId,
        status: "approved",
      });

      if (!invoice) {
        return sendError(
          res,
          400,
          "The approved invoice associated with this payment was not found."
        );
      }

      const completedRows = await Payment.aggregate([
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(companyId),
            invoiceId: payment.invoiceId,
            status: "completed",
            _id: { $ne: payment._id },
          },
        },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: "$amount" },
          },
        },
      ]);

      const alreadyPaid = roundMoney(
        completedRows[0]?.totalPaid || 0
      );

      if (
        roundMoney(alreadyPaid + payment.amount) >
        roundMoney(invoice.totalAmount) + 0.001
      ) {
        return sendError(
          res,
          400,
          "Completing this payment would exceed the invoice balance."
        );
      }
    }

    payment.status = status;

    payment.statusHistory.push({
      status,
      changedBy: userId,
      note: String(note).trim(),
    });

    await payment.save();

    const result = await populatePayment(
      Payment.findById(payment._id)
    );

    return res.json({
      message: `Payment status updated to ${status}.`,
      payment: result,
    });
  } catch (error) {
    next(error);
  }
};