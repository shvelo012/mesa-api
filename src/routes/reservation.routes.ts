import { Router } from "express";
import {
  createReservation,
  getUserReservations,
  cancelReservation,
  getRestaurantReservations,
  updateReservationStatus,
} from "../controllers/reservation.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "../models/User";

const router = Router();

router.post("/", authenticate, requireRole(Role.USER), createReservation);
router.get("/my", authenticate, requireRole(Role.USER), getUserReservations);
router.patch("/:id/cancel", authenticate, requireRole(Role.USER), cancelReservation);

router.get("/restaurant", authenticate, requireRole(Role.RESTAURANT_OWNER), getRestaurantReservations);
router.patch("/:id/status", authenticate, requireRole(Role.RESTAURANT_OWNER), updateReservationStatus);

export default router;
