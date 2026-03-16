import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getAllCustomers,
  updateCustomer,
} from "../controllers/customer.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { catchAsync } from "../utils/catchAsync.js";
import {
  createCustomerSchema,
  getCustomersSchema,
  updateCustomerSchema,
} from "../validators/customerSchemas.js";
import { objectIdParam } from "../validators/commonSchemas.js";

const router = Router();

router.get("/", authMiddleware, validate(getCustomersSchema), catchAsync(getAllCustomers));

router.post(
  "/",
  authMiddleware,
  validate(createCustomerSchema),
  catchAsync(createCustomer),
);

router.delete(
  "/:id",
  authMiddleware,
  validate(objectIdParam("id", "customer")),
  catchAsync(deleteCustomer),
);

router.patch(
  "/:id",
  authMiddleware,
  validate(objectIdParam("id", "customer").and(updateCustomerSchema)),
  catchAsync(updateCustomer),
);

export default router;
