import { Router } from "express";
import { loginProfessional, registerProfessional } from "../controllers/professional.controller";
import { AuthenticatedRequest, authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", registerProfessional);
router.post("/login", loginProfessional);
router.get("/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user,
  });
});

export default router;