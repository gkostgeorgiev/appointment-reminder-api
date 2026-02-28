import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { Customer } from "../models/Customer";

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
    return res.status(500).json({ message: "Server error" });
  }
};
