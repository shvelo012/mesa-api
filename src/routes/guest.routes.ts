import { Router } from "express";
import { listGuests, getGuestHistory, addGuestNote, deleteGuestNote } from "../controllers/guest.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, listGuests);
router.get("/:email/history", authenticate, getGuestHistory);
router.post("/:email/notes", authenticate, addGuestNote);
router.delete("/notes/:noteId", authenticate, deleteGuestNote);

export default router;
