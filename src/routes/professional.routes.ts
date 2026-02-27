import { Router } from "express";
import { loginProfessional, registerProfessional } from "../controllers/professional.controller";

const router = Router();

router.post("/register", registerProfessional);
router.post("/login", loginProfessional);

export default router;