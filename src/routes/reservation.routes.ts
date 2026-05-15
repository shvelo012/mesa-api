import { Router } from "express";
import {
  createReservation,
  getUserReservations,
  cancelReservation,
  getRestaurantReservations,
  updateReservationStatus,
  getAvailability,
  createManualReservation,
} from "../controllers/reservation.controller";
import { authenticate, optionalAuth, requireRole } from "../middleware/auth";
import { Role } from "../models/User";

const router = Router();

router.post("/", optionalAuth, createReservation);
router.get("/my", authenticate, requireRole(Role.USER), getUserReservations);
router.patch("/:id/cancel", authenticate, requireRole(Role.USER), cancelReservation);

router.get("/restaurant", authenticate, requireRole(Role.RESTAURANT_OWNER), getRestaurantReservations);
router.get("/availability", authenticate, requireRole(Role.RESTAURANT_OWNER), getAvailability);
router.post("/manual", authenticate, requireRole(Role.RESTAURANT_OWNER), createManualReservation);
router.patch("/:id/status", authenticate, requireRole(Role.RESTAURANT_OWNER), updateReservationStatus);

export default router;
