import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getAllCustomers,
  updateCustomer,
} from "../controllers/customer.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { catchAsync } from "../utils/catchAsync";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../validators/customerSchemas";
import { objectIdParam } from "../validators/commonSchemas";

const router = Router();

router.get("/", authMiddleware, catchAsync(getAllCustomers));

router.post(
  "/",
  authMiddleware,
  validate(createCustomerSchema),
  catchAsync(createCustomer),
);

router.delete(
  "/:id",
  authMiddleware,
  validate(objectIdParam("id")),
  catchAsync(deleteCustomer),
);

router.patch(
  "/:id",
  authMiddleware,
  validate(objectIdParam("id").extend(updateCustomerSchema)),
  catchAsync(updateCustomer),
);

export default router;
