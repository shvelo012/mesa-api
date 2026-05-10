import { Router } from "express";
import {
  createRestaurant,
  getMyRestaurant,
  updateRestaurant,
  listRestaurants,
  getRestaurantById,
} from "../controllers/restaurant.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "../models/User";

const router = Router();

router.get("/", listRestaurants);
router.get("/me", authenticate, requireRole(Role.RESTAURANT_OWNER), getMyRestaurant);
router.get("/:id", getRestaurantById);
router.post("/", authenticate, requireRole(Role.RESTAURANT_OWNER), createRestaurant);
router.put("/me", authenticate, requireRole(Role.RESTAURANT_OWNER), updateRestaurant);

export default router;
