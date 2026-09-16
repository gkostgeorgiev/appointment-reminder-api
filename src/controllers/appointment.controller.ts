import { Request, Response } from "express";
import mongoose, { ClientSession, FilterQuery } from "mongoose";
import z from "zod";
import { Appointment, IAppointment } from "../models/Appointment.js";
import { AppointmentLock } from "../models/AppointmentLock.js";
import { Customer } from "../models/Customer.js";
import { sendResponse } from "../utils/apiResponse.js";
import {
  getAppointmentEnd,
  getDateRange,
  getEndOfDay,
  getStartOfDay,
} from "../utils/dateUtils.js";
import { ErrorResponse } from "../utils/errorResponse.js";
import {
  createAppointmentSchema,
  getAppointmentsSchema,
  updateAppointmentSchema,
} from "../validators/appointmentSchema.js";

type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>["body"];
type GetAppointmentsQuery = z.infer<typeof getAppointmentsSchema>["query"];
type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>["body"];

// Runs `fn` inside a transaction, first bumping a per-professional lock
// document so concurrent create/update calls for the same professional
// serialize instead of both reading "no conflict" and committing an
// overlapping appointment. See AppointmentLock for why this is needed on
// top of the transaction itself. `session.withTransaction` retries the
// callback automatically on the resulting transient write conflict.
const withSchedulingLock = async <T>(
  professionalId: string,
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> => {
  const session = await mongoose.startSession();

  try {
    let result: T;

    await session.withTransaction(async () => {
      await AppointmentLock.findOneAndUpdate(
        { professional: professionalId },
        { $inc: { version: 1 } },
        { upsert: true, session },
      );

      result = await fn(session);
    });

    return result!;
  } finally {
    await session.endSession();
  }
};

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

  const appointment = await withSchedulingLock(
    req.user!.userId,
    async (session) => {
      const hasConflict = await hasAppointmentConflict(
        req.user!.userId,
        new Date(start),
        duration,
        undefined,
        session,
      );

      if (hasConflict) {
        throw new ErrorResponse(
          "Appointment overlaps with another booking",
          409,
        );
      }

      const doc = new Appointment({
        professional: req.user!.userId,
        customer,
        start: new Date(start),
        duration,
        service,
        notes,
      });

      await doc.save({ session });

      return doc;
    },
  );

  return sendResponse(res, 201, appointment);
};

// @desc    Get appointments
// @route   GET /api/appointments
// @access  Private
export const getAppointments = async (req: Request, res: Response) => {
  const { from, to, start, range, customer, page, limit } = req.validated!
    .query as GetAppointmentsQuery;

  const pageNum = page ?? 1;
  const limitNum = limit ?? 100;
  const skip = (pageNum - 1) * limitNum;

  const filter: FilterQuery<IAppointment> = {
    professional: req.user!.userId,
  };

  if (customer) {
    const existing = await Customer.findOne({
      _id: customer,
      professional: req.user!.userId,
    });

    if (!existing) {
      throw new ErrorResponse("Customer not found", 404);
    }

    filter.customer = customer;
  }

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
  } else if (!customer) {
    // No filter at all: default to a rolling window instead of full history.
    const now = new Date();
    const rollingStart = getStartOfDay(
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    );
    const rollingEnd = getEndOfDay(
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    );

    filter.start = { $gte: rollingStart, $lte: rollingEnd };
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ start: 1, _id: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate("customer", "firstName lastName phone email"),
    Appointment.countDocuments(filter),
  ]);

  return sendResponse(res, 200, {
    items: appointments,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
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

  const appointment = await withSchedulingLock(
    req.user!.userId,
    async (session) => {
      const existing = await Appointment.findOne({
        _id: req.params.id,
        professional: req.user!.userId,
      }).session(session);

      if (!existing) {
        throw new ErrorResponse("Appointment not found", 404);
      }

      const start = updateData.start
        ? new Date(updateData.start)
        : existing.start;
      const duration = updateData.duration ?? existing.duration;

      const hasConflict = await hasAppointmentConflict(
        req.user!.userId,
        start,
        duration,
        existing._id.toString(),
        session,
      );

      if (hasConflict) {
        throw new ErrorResponse(
          "Appointment overlaps with another booking",
          409,
        );
      }

      Object.assign(existing, updateData);
      await existing.save({ session });

      return existing;
    },
  );

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

export const hasAppointmentConflict = async (
  professionalId: string,
  start: Date,
  duration: number,
  excludeAppointmentId?: string,
  session?: ClientSession,
) => {
  const end = getAppointmentEnd(start, duration);

  const query: FilterQuery<IAppointment> & { $expr?: any } = {
    professional: professionalId,
    start: { $lt: end },
    $expr: {
      $gt: [{ $add: ["$start", { $multiply: ["$duration", 60000] }] }, start],
    },
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const conflict = await Appointment.exists(query).session(session ?? null);

  return !!conflict;
};
