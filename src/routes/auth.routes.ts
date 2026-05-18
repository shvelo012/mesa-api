import { Router } from "express";
import {
  register,
  login,
  refresh,
  me,
  verifyEmail,
  resendVerification,
  changePassword,
} from "../controllers/auth.controller";
import { activateStaffAccount } from "../controllers/staff.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", authenticate, me);
router.post("/activate", activateStaffAccount);

router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.put("/password", authenticate, changePassword);

export default router;
