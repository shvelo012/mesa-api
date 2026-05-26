import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { Plan } from "../models/Plan";
import { Feature } from "../models/Feature";
import { Subscription, SubscriptionStatus } from "../models/Subscription";
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

/**
 * Owner: upgrade / change plan (fake payment — no real charge).
 * Accepts card details purely for UX; validates format only.
 * Creates or updates the restaurant's subscription.
 */
export async function upgradePlan(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      planId: z.string().uuid(),
      // fake card fields — validated for format only, never stored
      cardNumber: z.string().regex(/^\d{16}$/, "Card number must be 16 digits"),
      expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Expiry must be MM/YY"),
      cvv: z.string().regex(/^\d{3,4}$/, "CVV must be 3-4 digits"),
      cardName: z.string().min(2),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const restaurant = await getRestaurantForUser(req.user!.userId);
    if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

    const plan = await Plan.findByPk(parsed.data.planId);
    if (!plan || !plan.isActive) { res.status(404).json({ error: "Plan not found" }); return; }

    // Simulate ~300ms payment processing
    await new Promise((r) => setTimeout(r, 300));

    const periodEnd = new Date(Date.now() + 30 * 86400000); // 30 days

    const existing = await Subscription.findOne({
      where: { restaurantId: restaurant.id },
      order: [["createdAt", "DESC"]],
    });

    let sub: Subscription;
    if (existing) {
      await existing.update({
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
      });
      sub = existing;
    } else {
      sub = await Subscription.create({
        restaurantId: restaurant.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
      });
    }

    const withRelations = await Subscription.findByPk(sub.id, {
      include: [{ model: Plan, include: [{ model: Feature }] }],
    });

    res.json({ subscription: withRelations, message: `Upgraded to ${plan.name}` });
  } catch {
    res.status(500).json({ error: "Payment failed. Please try again." });
  }
}

/** Owner: get merged feature keys (plan features + direct grants) */
export async function getMyFeatureKeys(req: AuthRequest, res: Response) {
  try {
    const restaurant = await getRestaurantForUser(req.user!.userId);
    if (!restaurant) { res.json([]); return; }
    const { getRestaurantFeatureKeys } = await import("../middleware/auth");
    const keys = await getRestaurantFeatureKeys(restaurant.id);
    res.json(keys);
  } catch {
    res.status(500).json({ error: "Failed to fetch features" });
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
