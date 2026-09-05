import { Router } from "express";
import {
  createAppointment,
  deleteAppointment,
  getAppointments,
  updateAppointment,
} from "../controllers/appointment.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { catchAsync } from "../utils/catchAsync.js";
import {
  createAppointmentSchema,
  deleteAppointmentSchema,
  getAppointmentsSchema,
  updateAppointmentSchema,
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

router.patch(
  "/:id",
  authMiddleware,
  validate(updateAppointmentSchema),
  catchAsync(updateAppointment),
);

router.delete(
  "/:id",
  authMiddleware,
  validate(deleteAppointmentSchema),
  catchAsync(deleteAppointment),
);

export default router;
