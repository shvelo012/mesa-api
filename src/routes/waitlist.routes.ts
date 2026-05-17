import { Router } from "express";
import {
  joinWaitlist,
  getRestaurantWaitlist,
  notifyWaitlistEntry,
  updateWaitlistStatus,
} from "../controllers/waitlist.controller";
import { authenticate, optionalAuth } from "../middleware/auth";

const router = Router();

router.post("/", optionalAuth, joinWaitlist);
router.get("/restaurant", authenticate, getRestaurantWaitlist);
router.patch("/:id/notify", authenticate, notifyWaitlistEntry);
router.patch("/:id/status", authenticate, updateWaitlistStatus);

export default router;
