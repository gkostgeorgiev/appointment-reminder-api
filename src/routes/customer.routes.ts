import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
} from "../controllers/customer.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { catchAsync } from "../utils/catchAsync.js";
import {
  createCustomerSchema,
  deleteCustomerSchema,
  getCustomerByIdSchema,
  getCustomersSchema,
  updateCustomerSchema,
} from "../validators/customerSchemas.js";

const router = Router();

router.get("/", authMiddleware, validate(getCustomersSchema), catchAsync(getAllCustomers));

router.get(
  "/:id",
  authMiddleware,
  validate(getCustomerByIdSchema),
  catchAsync(getCustomerById),
);

router.post(
  "/",
  authMiddleware,
  validate(createCustomerSchema),
  catchAsync(createCustomer),
);

router.delete(
  "/:id",
  authMiddleware,
  validate(deleteCustomerSchema),
  catchAsync(deleteCustomer),
);

router.patch(
  "/:id",
  authMiddleware,
  validate(updateCustomerSchema),
  catchAsync(updateCustomer),
);

export default router;
