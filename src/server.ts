import cors from "cors";
import "dotenv/config";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import connectDB from "./config/db.js";
import { swaggerSpec } from "./config/swagger.js";
import { startReminderJob } from "./jobs/reminderJob.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import devRoutes from "./routes/dev.routes.js";
import professionalRoutes from "./routes/professional.routes.js";

const API_VERSION = "v1";

const app = express();
const apiRouter = Router();

// Connect database
connectDB();

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// trust render's proxy for correct client IPs in logs and rate limiting
app.set("trust proxy", 1);

// Set security headers
app.use(helmet());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Prevent HTTP param pollution
app.use(hpp());

// Prevent overloading the API via json payloads:
app.use(express.json({ limit: "10kb" }));

// Middleware
app.use(cors());
app.use(requestIdMiddleware);
app.use(requestLogger);

// Test route
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

apiRouter.use("/professionals", professionalRoutes);
apiRouter.use("/customers", customerRoutes);
apiRouter.use("/appointments", appointmentRoutes);

app.use(`/api/${API_VERSION}`, apiRouter);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs-json", (_req, res) => {
  res.json(swaggerSpec);
});
if (process.env.NODE_ENV === "development") {
  app.use("/api/dev", devRoutes);
}

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  if (
    process.env.NODE_ENV !== "test" &&
    process.env.RUN_REMINDER_WORKER === "true"
  ) {
    startReminderJob();
  }
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully.");
  process.exit(0);
});
