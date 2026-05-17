import { Router } from "express";
import {
  createReservation,
  getUserReservations,
  cancelReservation,
  getRestaurantReservations,
  updateReservationStatus,
  getAvailability,
  createManualReservation,
  getReservationReport,
  bulkUpdateStatus,
  getPublicReservation,
  cancelReservationByToken,
} from "../controllers/reservation.controller";
import { authenticate, optionalAuth, requireRole } from "../middleware/auth";
import { Role } from "../models/User";

const router = Router();

// Public — confirmation token based (no auth)
router.get("/confirm/:token", getPublicReservation);
router.patch("/confirm/:token/cancel", cancelReservationByToken);

router.post("/", optionalAuth, createReservation);
router.get("/my", authenticate, requireRole(Role.USER), getUserReservations);
router.patch("/:id/cancel", authenticate, requireRole(Role.USER), cancelReservation);

router.get("/restaurant", authenticate, getRestaurantReservations);
router.get("/availability", authenticate, getAvailability);
router.get("/report", authenticate, getReservationReport);
router.post("/manual", authenticate, createManualReservation);
router.post("/bulk-status", authenticate, bulkUpdateStatus);
router.patch("/:id/status", authenticate, updateReservationStatus);

export default router;
