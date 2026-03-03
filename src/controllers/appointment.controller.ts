import { Request, Response } from "express";
import { FilterQuery } from "mongoose";
import z from "zod";
import { Appointment, IAppointment } from "../models/Appointment";
import { Customer } from "../models/Customer";
import { sendResponse } from "../utils/apiResponse";
import { getDateRange, getEndOfDay, getStartOfDay } from "../utils/dateUtils";
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
  const { from, to, date, range } = req.validated!
    .query as GetAppointmentsQuery;

  const filter: FilterQuery<IAppointment> = {
    professional: req.user!.userId,
  };

  if (range) {
    const { start, end } = getDateRange(range);

    filter.date = { $gte: start, $lte: end };
  } else if (date) {
    const startOfDay = getStartOfDay(new Date(date));

    const endOfDay = getEndOfDay(new Date(date));

    filter.date = {
      $gte: startOfDay,
      $lte: endOfDay,
    };
  } else if (from || to) {
    filter.date = {} as FilterQuery<IAppointment>["date"];

    if (from) {
      const start = getStartOfDay(new Date(from));
      filter.date.$gte = start;
    }

    if (to) {
      const end = getEndOfDay(new Date(to));
      filter.date.$lte = end;
    }
  }

  const appointments = await Appointment.find(filter)
    .sort({ date: 1 })
    .populate("customer", "firstName lastName phone email");

  return sendResponse(res, 200, appointments);
};
