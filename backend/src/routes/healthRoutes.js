
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ProcureFlow API is running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/ready", (req, res) => {
  const databaseConnected =
    mongoose.connection.readyState === 1;

  const statusCode = databaseConnected ? 200 : 503;

  res.status(statusCode).json({
    success: databaseConnected,
    message: databaseConnected
      ? "API and database are ready"
      : "Database is not connected",
    database: databaseConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
