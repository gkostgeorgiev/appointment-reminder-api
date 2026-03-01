import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "../controllers/customer.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { catchAsync } from "../utils/catchAsync";
import { updateCustomerSchema } from "../validators/customerSchemas";

const router = Router();

router.get("/", authMiddleware, catchAsync(getCustomers));
router.post("/", authMiddleware, catchAsync(createCustomer));
router.delete("/:id", authMiddleware, catchAsync(deleteCustomer));
router.patch(
  "/:id",
  authMiddleware,
  validate(updateCustomerSchema),
  catchAsync(updateCustomer),
);

export default router;
