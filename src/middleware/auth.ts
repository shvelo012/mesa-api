import { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../lib/jwt";
import { Role } from "../models/User";
import { Restaurant } from "../models/Restaurant";
import { RestaurantStaff, Permission } from "../models/RestaurantStaff";

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
