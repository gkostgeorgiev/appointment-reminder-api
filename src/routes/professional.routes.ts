import { Request, Router } from "express";
import {
  loginProfessional,
  registerProfessional,
} from "../controllers/professional.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { catchAsync } from "../utils/catchAsync";
import { loginProfessionalSchema, registerProfessionalSchema } from "../validators/professionalSchemas";

const router = Router();

router.post(
  "/register",
  validate(registerProfessionalSchema),
  catchAsync(registerProfessional),
);
router.post(
  "/login",
  validate(loginProfessionalSchema),
  catchAsync(loginProfessional),
);
router.get(
  "/me",
  authMiddleware,
  catchAsync(async (req: Request, res) => {
    res.json({
      message: "Protected route accessed",
      user: req.user,
    });
  }),
);

export default router;
