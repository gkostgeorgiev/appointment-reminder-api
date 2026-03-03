import { Request, Response } from "express";
import z from "zod";
import { Appointment } from "../models/Appointment";
import { Customer } from "../models/Customer";
import { sendResponse } from "../utils/apiResponse";
import { ErrorResponse } from "../utils/errorResponse";
import {
  createAppointmentSchema,
  getAppointmentsSchema,
} from "../validators/appointmentSchema";

type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>["body"];
type GetAppointmentsQuery = z.infer<typeof getAppointmentsSchema>["query"];

// @desc    Create appointment
// @route   POST /api/appointments
// @access  Private
export const createAppointment = async (req: Request, res: Response) => {
  const { customer, date, duration, service, notes } = req.validated!
    .body as CreateAppointmentInput;

  const existing = await Customer.findOne({
    _id: customer,
    professional: req.user!.userId,
  });

  if (!existing) {
    throw new ErrorResponse("Customer not found", 404);
  }

  const appointment = await Appointment.create({
    professional: req.user!.userId,
    customer,
    date: new Date(date),
    duration,
    service,
    notes,
  });

  return sendResponse(res, 201, appointment);
};

// @desc    Get appointments
// @route   GET /api/appointments
// @access  Private
export const getAppointments = async (req: Request, res: Response) => {
  const { start, end } = req.validated!.query as GetAppointmentsQuery;

  const filter: any = {
    professional: req.user!.userId,
  };

  if (start || end) {
    filter.date = {};

    if (start) {
      filter.date.$gte = new Date(start);
    }

    if (end) {
      filter.date.$lte = new Date(end);
    }
  }

  const appointments = await Appointment.find(filter)
    .sort({ date: 1 })
    .populate("customer", "firstName lastName phone email");

  return sendResponse(res, 200, appointments);
};
