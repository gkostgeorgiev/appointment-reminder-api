import { Router } from "express";
import {
  createAppointment,
  getAppointments,
} from "../controllers/appointment.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { catchAsync } from "../utils/catchAsync.js";
import {
  createAppointmentSchema,
  getAppointmentsSchema,
} from "../validators/appointmentSchema.js";

const router = Router();

router.get(
  "/",
  authMiddleware,
  validate(getAppointmentsSchema),
  catchAsync(getAppointments),
);

router.post(
  "/",
  authMiddleware,
  validate(createAppointmentSchema),
  catchAsync(createAppointment),
);

export default router;
