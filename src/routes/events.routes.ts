import { Router } from "express";
import { streamEvents } from "../controllers/events.controller";

const router = Router();

router.get("/stream", streamEvents);

export default router;
