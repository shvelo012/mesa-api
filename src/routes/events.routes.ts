import { Router } from "express";
import { issueToken, streamEvents } from "../controllers/events.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/token", authenticate, issueToken);
router.get("/stream", streamEvents);

export default router;
