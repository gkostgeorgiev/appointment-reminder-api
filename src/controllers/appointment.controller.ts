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
  updateAppointmentSchema,
} from "../validators/appointmentSchema";

type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>["body"];
type GetAppointmentsQuery = z.infer<typeof getAppointmentsSchema>["query"];
type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>["body"];

// @desc    Create appointment
// @route   POST /api/appointments
// @access  Private
export const createAppointment = async (req: Request, res: Response) => {
  const { customer, start, duration, service, notes } = req.validated!
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
    start: new Date(start),
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
  const { from, to, start, range } = req.validated!
    .query as GetAppointmentsQuery;

  const filter: FilterQuery<IAppointment> = {
    professional: req.user!.userId,
  };

  if (range) {
    const { rangeStart, rangeEnd } = getDateRange(range);

    filter.start = { $gte: rangeStart, $lte: rangeEnd };
  } else if (start) {
    const startOfDay = getStartOfDay(new Date(start));
    const endOfDay = getEndOfDay(new Date(start));

    filter.start = {
      $gte: startOfDay,
      $lte: endOfDay,
    };
  } else if (from || to) {
    filter.start = {} as FilterQuery<IAppointment>["start"];

    if (from) {
      filter.start.$gte = getStartOfDay(new Date(from));
    }

    if (to) {
      filter.start.$lte = getEndOfDay(new Date(to));
    }
  }

  const appointments = await Appointment.find(filter)
    .sort({ start: 1 })
    .populate("customer", "firstName lastName phone email");

  return sendResponse(res, 200, appointments);
};

// @desc    Update single appointment
// @route   PATCH /api/appointments/:id
// @access  Private
export const updateAppointment = async (req: Request, res: Response) => {
  const updateData = req.validated!.body as UpdateAppointmentInput;

  if (updateData.customer) {
    const customer = await Customer.findOne({
      _id: updateData.customer,
      professional: req.user!.userId,
    });

    if (!customer) {
      throw new ErrorResponse("Customer not found", 404);
    }
  }

  const appointment = await Appointment.findOneAndUpdate(
    {
      _id: req.params.id,
      professional: req.user!.userId,
    },
    updateData,
    { new: true, runValidators: true },
  );

  if (!appointment) {
    throw new ErrorResponse("Appointment not found", 404);
  }

  return sendResponse(res, 200, appointment);
};

// @desc    Delete single appointment
// @route   DELETE /api/appointments/:id
// @access  Private
export const deleteAppointment = async (req: Request, res: Response) => {
  const appointment = await Appointment.findOneAndDelete({
    _id: req.params.id,
    professional: req.user!.userId,
  });

  if (!appointment) {
    throw new ErrorResponse("Appointment not found", 404);
  }

  return sendResponse(res, 204);
};
