import { Request, Router } from "express";
import {
  loginProfessional,
  registerProfessional,
} from "../controllers/professional.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", registerProfessional);
router.post("/login", loginProfessional);
router.get("/me", authMiddleware, (req: Request, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user,
  });
});

export default router;
