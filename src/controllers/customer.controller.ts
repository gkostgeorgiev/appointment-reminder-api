import { Response } from "express";
import { MongoServerError } from "mongodb";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { Customer, ICustomer } from "../models/Customer";

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

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
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

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
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const deletedCustomer = await Customer.findOneAndDelete({
      _id: req.params.id,
      professional: req.user.userId,
    });

    console.log("deleted Customer: ", deletedCustomer);

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
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { firstName, lastName, phone, email } = req.body;

    const updateData: Partial<
      Pick<ICustomer, "firstName" | "lastName" | "phone" | "email">
    > = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;

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
