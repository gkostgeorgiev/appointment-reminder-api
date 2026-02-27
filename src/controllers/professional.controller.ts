import { Request, Response } from "express";
import { Professional } from "../models/Professional";

export const registerProfessional = async (
  req: Request,
  res: Response
) => {
  try {
    const { email, password, profession } = req.body;

    const existing = await Professional.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const professional = await Professional.create({
      email,
      password,
      profession,
    });

    res.status(201).json({
      id: professional._id,
      email: professional.email,
      profession: professional.profession,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};