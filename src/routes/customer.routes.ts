import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
} from "../controllers/customer.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.get("/", authMiddleware, getCustomers);
router.post("/", authMiddleware, createCustomer);
router.delete("/:id", authMiddleware, deleteCustomer);

export default router;
