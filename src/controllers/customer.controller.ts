import { Request, Response } from "express";
import z from "zod";
import { Appointment } from "../models/Appointment.js";
import { Customer } from "../models/Customer.js";
import { sendResponse } from "../utils/apiResponse.js";
import { ErrorResponse } from "../utils/errorResponse.js";
import { normalizeMsisdn } from "../utils/index.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../validators/customerSchemas.js";

type CreateCustomerInput = z.infer<typeof createCustomerSchema>["body"];
type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>["body"];
type GetCustomersQueryInput = {
  phone?: string;
  name?: string;
  page?: number;
  limit?: number;
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (req: Request, res: Response) => {
  const { firstName, lastName, phone, email } = req.validated!
    .body as CreateCustomerInput;

  const normalizedPhone = normalizeMsisdn(phone);

  const customer = await Customer.create({
    firstName,
    lastName,
    phone: normalizedPhone,
    email,
    professional: req.user!.userId,
  });

  return sendResponse(res, 201, customer);
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getAllCustomers = async (req: Request, res: Response) => {
  const { phone, name, page, limit } = (req.validated?.query ??
    req.query) as GetCustomersQueryInput;

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const skip = (pageNum - 1) * limitNum;

  const filter: Record<string, unknown> = {
    professional: req.user!.userId,
  };

  if (phone) {
    const normalizedPhone = normalizeMsisdn(phone);
    const escapedPhone = normalizedPhone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.phone = { $regex: escapedPhone, $options: "i" };
  }

  if (name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { firstName: { $regex: escapedName, $options: "i" } },
      { lastName: { $regex: escapedName, $options: "i" } },
    ];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limitNum),
    Customer.countDocuments(filter),
  ]);

  return sendResponse(res, 200, {
    items: customers,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

// @desc    Get a single customer
// @route   GET /api/customers/:id
// @access  Private
export const getCustomerById = async (req: Request, res: Response) => {
  const customer = await Customer.findOne({
    _id: req.params.id,
    professional: req.user!.userId,
  });

  if (!customer) {
    throw new ErrorResponse("Customer not found", 404);
  }

  return sendResponse(res, 200, customer);
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = async (req: Request, res: Response) => {
  // Policy: block deletion while the customer still has scheduled
  // appointments, rather than silently orphaning them (a deleted customer's
  // appointment would fail to populate in the reminder job). Completed/
  // cancelled/no-show history doesn't block deletion.
  const hasScheduledAppointments = await Appointment.exists({
    customer: req.params.id,
    professional: req.user!.userId,
    status: "scheduled",
  });

  if (hasScheduledAppointments) {
    throw new ErrorResponse(
      "Cannot delete a customer with scheduled appointments. Cancel or complete them first.",
      409,
    );
  }

  const deletedCustomer = await Customer.findOneAndDelete({
    _id: req.params.id,
    professional: req.user!.userId,
  });

  if (!deletedCustomer) {
    throw new ErrorResponse("Customer not found", 404);
  }

  return sendResponse(res, 204);
};

// @desc    Update a customer
// @route   PATCH /api/customers/:id
// @access  Private
export const updateCustomer = async (req: Request, res: Response) => {
  const updateData = req.validated!.body as UpdateCustomerInput;

  if (updateData.phone) {
    updateData.phone = normalizeMsisdn(updateData.phone);
  }

  const updatedCustomer = await Customer.findOneAndUpdate(
    {
      _id: req.params.id,
      professional: req.user!.userId,
    },
    updateData,
    { returnDocument: "after", runValidators: true },
  );

  if (!updatedCustomer) {
    throw new ErrorResponse("Customer not found", 404);
  }

  return sendResponse(res, 200, updatedCustomer);
};
