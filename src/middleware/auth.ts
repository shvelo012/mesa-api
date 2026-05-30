import { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../lib/jwt";
import { Role } from "../models/User";
import { Restaurant } from "../models/Restaurant";
import { RestaurantStaff, Permission } from "../models/RestaurantStaff";
import { Subscription, SubscriptionStatus } from "../models/Subscription";
import { Plan } from "../models/Plan";
import { Feature } from "../models/Feature";
import { PlanFeature } from "../models/PlanFeature";
import { RestaurantFeature } from "../models/RestaurantFeature";

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }
  try {
    const payload = verifyAccess(header.slice(7));
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyAccess(header.slice(7));
    } catch {
      // invalid token — treat as guest
    }
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as Role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== Role.ADMIN) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/**
 * Check restaurant has access to a feature.
 * Access granted if ANY of:
 *   1. Direct per-restaurant grant exists (restaurant_features row)
 *   2. Active subscription's plan includes the feature
 */
export function requireFeature(featureKey: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // ADMIN bypasses all feature checks
    if (req.user.role === Role.ADMIN) {
      next();
      return;
    }
    const restaurant = await getRestaurantForUser(req.user.userId);
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found" });
      return;
    }

    // 1. Direct restaurant-level grant
    const directGrant = await RestaurantFeature.findOne({
      where: { restaurantId: restaurant.id },
      include: [{ model: Feature, where: { key: featureKey, isActive: true } }],
    });
    if (directGrant) { next(); return; }

    // 2. Plan-based access via active subscription
    const sub = await Subscription.findOne({
      where: {
        restaurantId: restaurant.id,
        status: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE],
      },
      include: [{ model: Plan, include: [{ model: Feature }] }],
    });
    if (!sub) {
      res.status(403).json({ error: "No active subscription" });
      return;
    }
    const planFeatures: Feature[] = sub?.plan?.features ?? [];
    const hasFeature = planFeatures.some((f: Feature) => f.key === featureKey && f.isActive);
    if (!hasFeature) {
      res.status(403).json({ error: `Feature '${featureKey}' not included in your plan` });
      return;
    }
    next();
  };
}

/**
 * Helper: resolve all feature keys a restaurant currently has access to.
 * Merges plan features + direct grants. Used in API responses.
 */
export async function getRestaurantFeatureKeys(restaurantId: string): Promise<string[]> {
  const [directGrants, sub] = await Promise.all([
    RestaurantFeature.findAll({
      where: { restaurantId },
      include: [{ model: Feature, where: { isActive: true }, required: true }],
    }),
    Subscription.findOne({
      where: {
        restaurantId,
        status: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE],
      },
      include: [{ model: Plan, include: [{ model: Feature }] }],
      order: [["createdAt", "DESC"]],
    }),
  ]);

  const keys = new Set<string>();
  directGrants.forEach((g) => { if (g.feature?.key) keys.add(g.feature.key); });
  const planFeatures: Feature[] = sub?.plan?.features ?? [];
  planFeatures.forEach((f) => { if (f.isActive) keys.add(f.key); });
  return Array.from(keys);
}

export async function getRestaurantForUser(userId: string): Promise<Restaurant | null> {
  const asOwner = await Restaurant.findOne({ where: { ownerId: userId } });
  if (asOwner) return asOwner;
  const staffRecord = await RestaurantStaff.findOne({
    where: { userId, isActive: true },
    include: [Restaurant],
  });
  return staffRecord?.restaurant ?? null;
}

export async function getUserPermissions(userId: string, restaurantId: string): Promise<Permission[]> {
  const restaurant = await Restaurant.findByPk(restaurantId);
  if (restaurant?.ownerId === userId) {
    return Object.values(Permission);
  }
  const staff = await RestaurantStaff.findOne({
    where: { userId, restaurantId, isActive: true },
  });
  return staff?.permissions ?? [];
}

export function requireRestaurantPermission(...required: Permission[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const restaurant = await getRestaurantForUser(req.user.userId);
    if (!restaurant) {
      res.status(404).json({ error: "No restaurant found" });
      return;
    }
    const perms = await getUserPermissions(req.user.userId, restaurant.id);
    const missing = required.filter((p) => !perms.includes(p));
    if (missing.length > 0) {
      res.status(403).json({ error: `Missing permissions: ${missing.join(", ")}` });
      return;
    }
    (req as unknown as Record<string, unknown>).restaurant = restaurant;
    next();
  };
}
