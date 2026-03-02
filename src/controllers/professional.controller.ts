import { Request, Response } from "express";
import z from "zod";
import { Professional } from "../models/Professional";
import { ErrorResponse } from "../utils/errorResponse";
import { generateToken } from "../utils/jwt";
import { loginProfessionalSchema, registerProfessionalSchema } from "../validators/professionalSchemas";

type RegisterInput = z.infer<typeof registerProfessionalSchema>["body"];
type LoginInput = z.infer<typeof loginProfessionalSchema>["body"];

export const registerProfessional = async (req: Request, res: Response) => {
  const { email, password, profession } = req.validated!.body as RegisterInput;
  const professional = await Professional.create({
    email,
    password,
    profession,
  });

  const token = generateToken({
    userId: professional.id,
    email: professional.email,
  });

  return res.status(201).json({
    id: professional._id,
    email: professional.email,
    profession: professional.profession,
    token,
  });
};

export const loginProfessional = async (req: Request, res: Response) => {
  const { email, password } = req.validated!.body as LoginInput;

  const professional = await Professional.findOne({ email });

  if (!professional) {
    throw new ErrorResponse("Invalid credentials", 401);
  }

  const isMatch = await professional.comparePassword(password);

  if (!isMatch) {
    throw new ErrorResponse("Invalid credentials", 401);
  }

  const token = generateToken({
    userId: professional.id,
    email: professional.email,
  });

  return res.status(200).json({
    message: "Login successful",
    token,
  });
};
