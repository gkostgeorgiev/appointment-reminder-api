import { Router } from "express";
import { createCustomer } from "../controllers/customer.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.post("/", authMiddleware, createCustomer);

export default router;