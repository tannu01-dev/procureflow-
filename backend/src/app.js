
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const companyRoutes = require("./routes/companyRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const purchaseRequestRoutes = require("./routes/purchaseRequestRoutes");
const approvalRoutes = require("./routes/approvalRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const rfqRoutes = require("./routes/rfqRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const goodsReceiptRoutes = require("./routes/goodsReceiptRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const { auditLogger } = require("./middleware/auditLogger");


const app = express();

app.disable("x-powered-by");
app.use(helmet());

// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
//   })
// );


const allowedOrigins = [
  "http://localhost:3000",
  "https://procureflow-topaz.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "ProcureFlow API",
    health: "/api/health",
  });
});

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

app.use(auditLogger);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/purchase-requests", purchaseRequestRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/rfqs", rfqRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/goods-receipts", goodsReceiptRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/audit-logs", auditLogRoutes);



app.use(notFound);
app.use(errorHandler);

module.exports = app;
