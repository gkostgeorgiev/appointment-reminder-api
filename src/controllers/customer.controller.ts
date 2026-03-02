import { Request, Response } from "express";
import z from "zod";
import { Customer } from "../models/Customer";
import { ErrorResponse } from "../utils/errorResponse";
import { updateCustomerSchema } from "../validators/customerSchemas";

type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>["body"];

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (req: Request, res: Response) => {
  const { firstName, lastName, phone, email } = req.body;

  const customer = await Customer.create({
    firstName,
    lastName,
    phone,
    email,
    professional: req.user!.userId,
  });

  return res.status(201).json(customer);
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getAllCustomers = async (req: Request, res: Response) => {
  const customers = await Customer.find({
    professional: req.user.userId,
  }).sort({ createdAt: -1 });

  return res.status(200).json(customers);
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = async (req: Request, res: Response) => {
  const deletedCustomer = await Customer.findOneAndDelete({
    _id: req.params.id,
    professional: req.user.userId,
  });

  if (!deletedCustomer) {
    throw new ErrorResponse("Customer not found", 404);
  }

  return res.status(200).json({
    message: `Customer ${deletedCustomer.firstName} ${deletedCustomer.lastName} deleted successfully`,
  });
};

// @desc    Update a customer
// @route   PATCH /api/customers/:id
// @access  Private
export const updateCustomer = async (req: Request, res: Response) => {
  const updateData = req.validated!.body as UpdateCustomerInput;

  const updatedCustomer = await Customer.findOneAndUpdate(
    {
      _id: req.params.id,
      professional: req.user!.userId,
    },
    updateData,
    { new: true, runValidators: true },
  );

  if (!updatedCustomer) {
    throw new ErrorResponse("Customer not found", 404);
  }

  return res.status(200).json(updatedCustomer);
};
