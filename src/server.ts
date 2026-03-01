import cors from "cors";
import "dotenv/config";
import express from "express";

import connectDB from "./config/db";
import { errorHandler } from "./middleware/errorHandler";
import customerRoutes from "./routes/customer.routes";
import professionalRoutes from "./routes/professional.routes";

const app = express();

// Connect database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (_req, res) => {
  res.send("API is running...");
});

app.use("/api/professionals", professionalRoutes);
app.use("/api/customers", customerRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
