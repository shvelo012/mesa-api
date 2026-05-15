import { Router } from "express";
import {
  inviteStaff,
  listStaff,
  updateStaff,
  removeStaff,
} from "../controllers/staff.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, listStaff);
router.post("/", authenticate, inviteStaff);
router.patch("/:staffId", authenticate, updateStaff);
router.delete("/:staffId", authenticate, removeStaff);

export default router;
