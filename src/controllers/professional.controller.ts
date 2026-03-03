import { Request, Response } from "express";
import z from "zod";
import { Professional } from "../models/Professional";
import { sendResponse } from "../utils/apiResponse";
import { ErrorResponse } from "../utils/errorResponse";
import { generateToken } from "../utils/jwt";
import {
  loginProfessionalSchema,
  registerProfessionalSchema,
} from "../validators/professionalSchemas";

type RegisterInput = z.infer<typeof registerProfessionalSchema>["body"];
type LoginInput = z.infer<typeof loginProfessionalSchema>["body"];

// @desc    Register professional
// @route   POST /api/professionals/register
// @access  Public
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

  return sendResponse(res, 201, {
    id: professional._id,
    email: professional.email,
    profession: professional.profession,
    token,
  });
};

// @desc    Login professional
// @route   POST /api/professionals/login
// @access  Public
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

  return sendResponse(res, 200, {
    token,
  });
};
