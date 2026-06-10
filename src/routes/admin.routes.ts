import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import {
  getStats,
  listUsers,
  updateUser,
  deleteUser,
  listRestaurantsAdmin,
  listFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  listPlansAdmin,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanFeature,
  setPlanFeatures,
  listSubscriptionsAdmin,
  createSubscription,
  updateSubscription,
  listRestaurantFeatures,
  toggleRestaurantFeature,
  listPayments,
} from "../controllers/admin.controller";

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

// Stats
router.get("/stats", getStats);

// Users
router.get("/users", listUsers);
router.patch("/users/:userId", updateUser);
router.delete("/users/:userId", deleteUser);

// Restaurants
router.get("/restaurants", listRestaurantsAdmin);
router.get("/restaurants/:restaurantId/features", listRestaurantFeatures);
router.post("/restaurants/:restaurantId/features/:featureId/toggle", toggleRestaurantFeature);

// Features
router.get("/features", listFeatures);
router.post("/features", createFeature);
router.patch("/features/:featureId", updateFeature);
router.delete("/features/:featureId", deleteFeature);

// Plans
router.get("/plans", listPlansAdmin);
router.post("/plans", createPlan);
router.patch("/plans/:planId", updatePlan);
router.delete("/plans/:planId", deletePlan);
router.post("/plans/:planId/features/:featureId/toggle", togglePlanFeature);
router.put("/plans/:planId/features", setPlanFeatures);

// Subscriptions
router.get("/subscriptions", listSubscriptionsAdmin);
router.post("/subscriptions", createSubscription);
router.patch("/subscriptions/:subId", updateSubscription);

// Payments / transaction ledger
router.get("/payments", listPayments);

export default router;
