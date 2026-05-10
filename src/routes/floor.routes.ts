import { Router } from "express";
import {
  createFloor,
  getFloor,
  updateFloor,
  deleteFloor,
  saveLayout,
} from "../controllers/floor.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "../models/User";

const router = Router();

router.get("/:id", authenticate, getFloor);
router.post("/", authenticate, requireRole(Role.RESTAURANT_OWNER), createFloor);
router.put("/:id", authenticate, requireRole(Role.RESTAURANT_OWNER), updateFloor);
router.delete("/:id", authenticate, requireRole(Role.RESTAURANT_OWNER), deleteFloor);
router.post("/:id/layout", authenticate, requireRole(Role.RESTAURANT_OWNER), saveLayout);

export default router;
