import { Request, Response } from "express";
import { Professional } from "../models/Professional";

export const registerProfessional = async (req: Request, res: Response) => {
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

export const loginProfessional = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const professional = await Professional.findOne({ email });

    if (!professional) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await professional.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.status(200).json({
      message: "Login successful",
      id: professional._id,
      email: professional.email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};