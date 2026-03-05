import cors from "cors";
import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";
import morgan from "morgan";

import connectDB from "./config/db";
import { startReminderJob } from "./jobs/reminderJob";
import { errorHandler } from "./middleware/errorHandler";
import appointmentRoutes from "./routes/appointment.routes";
import customerRoutes from "./routes/customer.routes";
import devRoutes from "./routes/dev.routes";
import professionalRoutes from "./routes/professional.routes";

const app = express();

// Connect database
connectDB();

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Set security headers
app.use(helmet());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
});

app.use(limiter);

// Prevent HTTP param pollution
app.use(hpp());

// Prevent overloading the API via json payloads:
app.use(express.json({ limit: "10kb" }));

// Middleware
app.use(cors());

// Test route
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/professionals", professionalRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/dev", devRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (
    process.env.NODE_ENV !== "test" &&
    process.env.RUN_REMINDER_WORKER === "true"
  ) {
    startReminderJob();
  }
});
