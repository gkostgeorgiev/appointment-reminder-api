import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "../controllers/customer.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { updateCustomerSchema } from "../validators/customerSchemas";

const router = Router();

router.get("/", authMiddleware, getCustomers);
router.post("/", authMiddleware, createCustomer);
router.delete("/:id", authMiddleware, deleteCustomer);
router.patch(
  "/:id",
  authMiddleware,
  validate(updateCustomerSchema),
  updateCustomer,
);

export default router;
