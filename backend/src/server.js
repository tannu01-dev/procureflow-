
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`ProcureFlow API running at http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log(`Ready: http://localhost:${PORT}/api/health/ready`);
    });

    function shutdown(signal) {
      console.log(`${signal} received. Closing server...`);

      server.close(async () => {
        try {
          const mongoose = require("mongoose");
          await mongoose.disconnect();
          process.exit(0);
        } catch (error) {
          console.error("Shutdown error:", error.message);
          process.exit(1);
        }
      });
    }

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("ProcureFlow startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
