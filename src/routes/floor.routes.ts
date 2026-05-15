import { Router } from "express";
import {
  createFloor,
  getFloor,
  updateFloor,
  deleteFloor,
  saveLayout,
} from "../controllers/floor.controller";
import { authenticate, optionalAuth } from "../middleware/auth";

const router = Router();

router.get("/:id", optionalAuth, getFloor);
router.post("/", authenticate, createFloor);
router.put("/:id", authenticate, updateFloor);
router.delete("/:id", authenticate, deleteFloor);
router.post("/:id/layout", authenticate, saveLayout);

export default router;
