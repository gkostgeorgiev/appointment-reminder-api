import { Router } from "express";
import { getAppointments } from "../controllers/appointment.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { catchAsync } from "../utils/catchAsync";
import { getAppointmentsSchema } from "../validators/appointmentSchema";

const router = Router();

router.get(
  "/",
  authMiddleware,
  validate(getAppointmentsSchema),
  catchAsync(getAppointments),
);
