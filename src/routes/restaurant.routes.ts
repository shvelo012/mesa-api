import { Router } from "express";
import {
  createRestaurant,
  getMyRestaurant,
  getMyRestaurants,
  updateRestaurant,
  listRestaurants,
  getRestaurantById,
  getPublicAvailability,
} from "../controllers/restaurant.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "../models/User";
import staffRoutes from "./staff.routes";

const router = Router();

router.get("/", listRestaurants);
router.get("/me", authenticate, getMyRestaurant);
router.get("/me/all", authenticate, getMyRestaurants);
router.get("/:id", getRestaurantById);
router.get("/:idOrSlug/availability", getPublicAvailability);
router.post("/", authenticate, requireRole(Role.RESTAURANT_OWNER), createRestaurant);
router.put("/me", authenticate, updateRestaurant);

// Staff management nested under /restaurants/:id/staff
router.use("/:id/staff", staffRoutes);

export default router;
