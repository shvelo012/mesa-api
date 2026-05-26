import { Router } from "express";
import { listGuests, getGuestHistory, addGuestNote, deleteGuestNote } from "../controllers/guest.controller";
import { authenticate, requireFeature } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, requireFeature("guest_notes"), listGuests);
router.get("/:email/history", authenticate, requireFeature("guest_notes"), getGuestHistory);
router.post("/:email/notes", authenticate, requireFeature("guest_notes"), addGuestNote);
router.delete("/notes/:noteId", authenticate, requireFeature("guest_notes"), deleteGuestNote);

export default router;
