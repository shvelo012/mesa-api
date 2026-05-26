import { Router } from "express";
import { listPlans, getMySubscription, upgradePlan, getMyFeatureKeys } from "../controllers/plan.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", listPlans);
router.get("/my-subscription", authenticate, getMySubscription);
router.get("/my-features", authenticate, getMyFeatureKeys);
router.post("/upgrade", authenticate, upgradePlan);

export default router;
