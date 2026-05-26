import { Router } from "express";
import {
  inviteStaff,
  listStaff,
  updateStaff,
  removeStaff,
} from "../controllers/staff.controller";
import { authenticate, requireFeature } from "../middleware/auth";

const router = Router();

// All staff management requires the staff_management feature
router.get("/", authenticate, requireFeature("staff_management"), listStaff);
router.post("/", authenticate, requireFeature("staff_management"), inviteStaff);
router.patch("/:staffId", authenticate, requireFeature("staff_management"), updateStaff);
router.delete("/:staffId", authenticate, requireFeature("staff_management"), removeStaff);

export default router;
