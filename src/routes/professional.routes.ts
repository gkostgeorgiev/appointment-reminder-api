import { Router } from "express";
import { registerProfessional } from "../controllers/professional.controller";

const router = Router();

router.post("/register", registerProfessional);

export default router;