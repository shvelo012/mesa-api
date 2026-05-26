import { Router } from "express";
import {
  joinWaitlist,
  getRestaurantWaitlist,
  notifyWaitlistEntry,
  updateWaitlistStatus,
} from "../controllers/waitlist.controller";
import { authenticate, optionalAuth, requireFeature } from "../middleware/auth";

const router = Router();

// Guest joining requires the restaurant to have waitlist feature
router.post("/", optionalAuth, requireFeature("waitlist"), joinWaitlist);

// Owner management
router.get("/restaurant", authenticate, requireFeature("waitlist"), getRestaurantWaitlist);
router.patch("/:id/notify", authenticate, requireFeature("waitlist"), notifyWaitlistEntry);
router.patch("/:id/status", authenticate, requireFeature("waitlist"), updateWaitlistStatus);

export default router;
