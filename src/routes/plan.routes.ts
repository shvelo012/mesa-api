import { Router } from "express";
import { listPlans, getMySubscription } from "../controllers/plan.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", listPlans);
router.get("/my-subscription", authenticate, getMySubscription);

export default router;
