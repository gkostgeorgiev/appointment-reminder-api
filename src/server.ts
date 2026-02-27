import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db";

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});