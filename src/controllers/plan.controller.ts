import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Plan } from "../models/Plan";
import { Feature } from "../models/Feature";
import { Subscription } from "../models/Subscription";
import { Restaurant } from "../models/Restaurant";
import { getRestaurantForUser } from "../middleware/auth";

/** Public: list all active plans with features */
export async function listPlans(_req: AuthRequest, res: Response) {
  try {
    const plans = await Plan.findAll({
      where: { isActive: true },
      include: [{ model: Feature, where: { isActive: true }, required: false }],
      order: [["sortOrder", "ASC"]],
    });
    res.json(plans);
  } catch {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
}

/** Owner: get own subscription */
export async function getMySubscription(req: AuthRequest, res: Response) {
  try {
    const restaurant = await getRestaurantForUser(req.user!.userId);
    if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

    const sub = await Subscription.findOne({
      where: { restaurantId: restaurant.id },
      include: [{ model: Plan, include: [{ model: Feature }] }],
      order: [["createdAt", "DESC"]],
    });

    res.json(sub ?? null);
  } catch {
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
}
