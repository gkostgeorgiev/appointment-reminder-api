import { Router } from "express";
import {
  createAppointment,
  getAppointments,
} from "../controllers/appointment.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { catchAsync } from "../utils/catchAsync";
import {
  createAppointmentSchema,
  getAppointmentsSchema,
} from "../validators/appointmentSchema";

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
