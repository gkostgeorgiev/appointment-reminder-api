import { Request, Response } from "express";
import { MongoServerError } from "mongodb";
import z from "zod";
import { Customer } from "../models/Customer";
import { updateCustomerSchema } from "../validators/customerSchemas";

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (
  req: Request,
  res: Response,
) => {
  try {
    const { firstName, lastName, phone, email } = req.body;

    const customer = await Customer.create({
      firstName,
      lastName,
      phone,
      email,
      professional: req.user.userId,
    });

    return res.status(201).json(customer);
  } catch (error) {
    console.error(error);

    if (error instanceof MongoServerError && error.code === 11000) {
      return res.status(409).json({
        message: "Customer with this phone number already exists",
      });
    }

    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (
  req: Request,
  res: Response,
) => {
  try {
    const customers = await Customer.find({
      professional: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.status(200).json(customers);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = async (
  req: Request,
  res: Response,
) => {
  try {
    const deletedCustomer = await Customer.findOneAndDelete({
      _id: req.params.id,
      professional: req.user.userId,
    });

    if (!deletedCustomer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      message: `Customer ${deletedCustomer.firstName} ${deletedCustomer.lastName} deleted successfully`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update a customer
// @route   PATCH /api/customers/:id
// @access  Private
export const updateCustomer = async (
  req: Request,
  res: Response,
) => {
  try {
    type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>["body"];

    const updateData = req.validated!.body as UpdateCustomerInput;

    const updatedCustomer = await Customer.findOneAndUpdate(
      {
        _id: req.params.id,
        professional: req.user.userId,
      },
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    return res.status(200).json(updatedCustomer);
  } catch (error) {
    console.error(error);

    if (error instanceof MongoServerError && error.code === 11000) {
      return res.status(409).json({
        message: "Customer with this phone already exists",
      });
    }

    return res.status(500).json({ message: "Server error" });
  }
};
