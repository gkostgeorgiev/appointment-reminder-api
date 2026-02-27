import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db";

import professionalRoutes from "./routes/professional.routes";

const app = express();

// Connect database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
    res.send("API is running...");
});

app.use("/api/professionals", professionalRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});