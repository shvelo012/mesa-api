import { Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { AuthRequest } from "../middleware/auth";
import { User, Role } from "../models/User";
import { Restaurant } from "../models/Restaurant";
import { Feature } from "../models/Feature";
import { Plan } from "../models/Plan";
import { PlanFeature } from "../models/PlanFeature";
import { Subscription, SubscriptionStatus } from "../models/Subscription";
import { RestaurantFeature } from "../models/RestaurantFeature";
import { Payment, PaymentStatus, PaymentProviderKey } from "../models/Payment";

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(_req: AuthRequest, res: Response) {
  try {
    const [totalUsers, totalRestaurants, totalSubscriptions] = await Promise.all([
      User.count(),
      Restaurant.count(),
      Subscription.count(),
    ]);

    const byStatus = await Subscription.findAll({
      attributes: ["status"],
      group: ["status"],
      raw: true,
    }) as unknown as { status: string; count: string }[];

    const byPlan = await Subscription.findAll({
      include: [{ model: Plan, attributes: ["name", "slug"] }],
      attributes: ["planId"],
      group: ["planId", "plan.id", "plan.name", "plan.slug"],
      raw: true,
    }) as unknown as { planId: string; "plan.name": string; "plan.slug": string; count: string }[];

    res.json({
      totalUsers,
      totalRestaurants,
      totalSubscriptions,
      byStatus,
      byPlan,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(req: AuthRequest, res: Response) {
  try {
    const { search, role, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where[Op.or as unknown as string] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password", "emailVerificationToken"] },
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset,
    });

    res.json({ users: rows, total: count, page: Number(page), limit: Number(limit) });
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      role: z.nativeEnum(Role).optional(),
      emailVerified: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const user = await User.findByPk(req.params.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Prevent removing own admin role
    if (req.user?.userId === user.id && parsed.data.role && parsed.data.role !== Role.ADMIN) {
      res.status(400).json({ error: "Cannot remove own admin role" });
      return;
    }

    await user.update(parsed.data);
    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to update user" });
  }
}

export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (req.user?.userId === user.id) { res.status(400).json({ error: "Cannot delete own account" }); return; }
    await user.destroy();
    res.json({ message: "User deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
}

// ─── Restaurants ──────────────────────────────────────────────────────────────

export async function listRestaurantsAdmin(req: AuthRequest, res: Response) {
  try {
    const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (search) {
      where[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Restaurant.findAndCountAll({
      where,
      include: [
        { model: User, as: "owner", attributes: ["id", "name", "email"] },
        {
          model: Subscription,
          include: [{ model: Plan, include: [{ model: Feature }] }],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset,
    });

    res.json({ restaurants: rows, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
}

// ─── Features ─────────────────────────────────────────────────────────────────

export async function listFeatures(_req: AuthRequest, res: Response) {
  try {
    const features = await Feature.findAll({ order: [["name", "ASC"]] });
    res.json(features);
  } catch {
    res.status(500).json({ error: "Failed to fetch features" });
  }
}

export async function createFeature(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      key: z.string().min(1).regex(/^[a-z_]+$/, "key must be lowercase snake_case"),
      name: z.string().min(1),
      description: z.string().optional(),
      isActive: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const existing = await Feature.findOne({ where: { key: parsed.data.key } });
    if (existing) { res.status(409).json({ error: "Feature key already exists" }); return; }

    const feature = await Feature.create(parsed.data);
    res.status(201).json(feature);
  } catch {
    res.status(500).json({ error: "Failed to create feature" });
  }
}

export async function updateFeature(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const feature = await Feature.findByPk(req.params.featureId);
    if (!feature) { res.status(404).json({ error: "Feature not found" }); return; }

    await feature.update(parsed.data);
    res.json(feature);
  } catch {
    res.status(500).json({ error: "Failed to update feature" });
  }
}

export async function deleteFeature(req: AuthRequest, res: Response) {
  try {
    const feature = await Feature.findByPk(req.params.featureId);
    if (!feature) { res.status(404).json({ error: "Feature not found" }); return; }
    await feature.destroy();
    res.json({ message: "Feature deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete feature" });
  }
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function listPlansAdmin(_req: AuthRequest, res: Response) {
  try {
    const plans = await Plan.findAll({
      include: [{ model: Feature }],
      order: [["sortOrder", "ASC"]],
    });
    res.json(plans);
  } catch {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
}

export async function createPlan(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      slug: z.string().min(1).regex(/^[a-z_]+$/, "slug must be lowercase snake_case"),
      name: z.string().min(1),
      description: z.string().optional(),
      priceMonthly: z.number().int().min(0).default(0),
      trialDays: z.number().int().min(0).nullable().default(null),
      isActive: z.boolean().default(true),
      sortOrder: z.number().int().default(0),
      featureIds: z.array(z.string().uuid()).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const existing = await Plan.findOne({ where: { slug: parsed.data.slug } });
    if (existing) { res.status(409).json({ error: "Plan slug already exists" }); return; }

    const { featureIds, ...planData } = parsed.data;
    const plan = await Plan.create(planData);

    if (featureIds.length > 0) {
      await PlanFeature.bulkCreate(
        featureIds.map((featureId) => ({ planId: plan.id, featureId }))
      );
    }

    const withFeatures = await Plan.findByPk(plan.id, { include: [{ model: Feature }] });
    res.status(201).json(withFeatures);
  } catch {
    res.status(500).json({ error: "Failed to create plan" });
  }
}

export async function updatePlan(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      priceMonthly: z.number().int().min(0).optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const plan = await Plan.findByPk(req.params.planId);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

    await plan.update(parsed.data);
    const withFeatures = await Plan.findByPk(plan.id, { include: [{ model: Feature }] });
    res.json(withFeatures);
  } catch {
    res.status(500).json({ error: "Failed to update plan" });
  }
}

export async function deletePlan(req: AuthRequest, res: Response) {
  try {
    const plan = await Plan.findByPk(req.params.planId);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

    const subCount = await Subscription.count({ where: { planId: plan.id, status: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE] } });
    if (subCount > 0) {
      res.status(400).json({ error: `Cannot delete: ${subCount} active subscription(s) on this plan` });
      return;
    }

    await plan.destroy();
    res.json({ message: "Plan deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete plan" });
  }
}

/** Toggle a single feature on/off for a plan */
export async function togglePlanFeature(req: AuthRequest, res: Response) {
  try {
    const { planId, featureId } = req.params;
    const plan = await Plan.findByPk(planId);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
    const feature = await Feature.findByPk(featureId);
    if (!feature) { res.status(404).json({ error: "Feature not found" }); return; }

    const existing = await PlanFeature.findOne({ where: { planId, featureId } });
    if (existing) {
      await existing.destroy();
      res.json({ enabled: false });
    } else {
      await PlanFeature.create({ planId, featureId });
      res.json({ enabled: true });
    }
  } catch {
    res.status(500).json({ error: "Failed to toggle feature" });
  }
}

/** Replace all features for a plan in one call */
export async function setPlanFeatures(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({ featureIds: z.array(z.string().uuid()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const plan = await Plan.findByPk(req.params.planId);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

    await PlanFeature.destroy({ where: { planId: plan.id } });
    if (parsed.data.featureIds.length > 0) {
      await PlanFeature.bulkCreate(
        parsed.data.featureIds.map((featureId) => ({ planId: plan.id, featureId }))
      );
    }

    const withFeatures = await Plan.findByPk(plan.id, { include: [{ model: Feature }] });
    res.json(withFeatures);
  } catch {
    res.status(500).json({ error: "Failed to set plan features" });
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function listSubscriptionsAdmin(req: AuthRequest, res: Response) {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const { rows, count } = await Subscription.findAndCountAll({
      where,
      include: [
        { model: Plan, include: [{ model: Feature }] },
        { model: Restaurant, attributes: ["id", "name", "slug", "email"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset,
    });

    res.json({ subscriptions: rows, total: count, page: Number(page), limit: Number(limit) });
  } catch {
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
}

export async function updateSubscription(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      planId: z.string().uuid().optional(),
      status: z.nativeEnum(SubscriptionStatus).optional(),
      trialEndsAt: z.string().datetime().nullable().optional(),
      currentPeriodEnd: z.string().datetime().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const sub = await Subscription.findByPk(req.params.subId);
    if (!sub) { res.status(404).json({ error: "Subscription not found" }); return; }

    await sub.update(parsed.data);
    const updated = await Subscription.findByPk(sub.id, {
      include: [{ model: Plan, include: [{ model: Feature }] }, { model: Restaurant }],
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update subscription" });
  }
}

export async function createSubscription(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      restaurantId: z.string().uuid(),
      planId: z.string().uuid(),
      status: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.TRIALING),
      trialEndsAt: z.string().datetime().nullable().optional(),
      currentPeriodEnd: z.string().datetime().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const restaurant = await Restaurant.findByPk(parsed.data.restaurantId);
    if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

    const plan = await Plan.findByPk(parsed.data.planId);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

    // Auto-set trialEndsAt if plan has trialDays and not provided
    let trialEndsAt = parsed.data.trialEndsAt ? new Date(parsed.data.trialEndsAt) : null;
    if (!trialEndsAt && plan.trialDays && parsed.data.status === SubscriptionStatus.TRIALING) {
      trialEndsAt = new Date(Date.now() + plan.trialDays * 86400000);
    }

    const sub = await Subscription.create({
      ...parsed.data,
      trialEndsAt,
      currentPeriodEnd: parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : null,
    });

    const withRelations = await Subscription.findByPk(sub.id, {
      include: [{ model: Plan, include: [{ model: Feature }] }, { model: Restaurant }],
    });
    res.status(201).json(withRelations);
  } catch {
    res.status(500).json({ error: "Failed to create subscription" });
  }
}

// ─── Restaurant Feature Grants ────────────────────────────────────────────────

/**
 * GET /admin/restaurants/:restaurantId/features
 * Returns all features with `enabled` flag indicating direct grant status.
 */
export async function listRestaurantFeatures(req: AuthRequest, res: Response) {
  try {
    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

    const [allFeatures, grants] = await Promise.all([
      Feature.findAll({ order: [["name", "ASC"]] }),
      RestaurantFeature.findAll({ where: { restaurantId } }),
    ]);

    const grantedIds = new Set(grants.map((g) => g.featureId));

    res.json(
      allFeatures.map((f) => ({
        ...f.toJSON(),
        enabled: grantedIds.has(f.id),
        grantedAt: grants.find((g) => g.featureId === f.id)?.createdAt ?? null,
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch restaurant features" });
  }
}

/**
 * POST /admin/restaurants/:restaurantId/features/:featureId/toggle
 * Add or remove a direct feature grant for a restaurant.
 */
export async function toggleRestaurantFeature(req: AuthRequest, res: Response) {
  try {
    const { restaurantId, featureId } = req.params;

    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

    const feature = await Feature.findByPk(featureId);
    if (!feature) { res.status(404).json({ error: "Feature not found" }); return; }

    const existing = await RestaurantFeature.findOne({ where: { restaurantId, featureId } });
    if (existing) {
      await existing.destroy();
      res.json({ enabled: false, restaurantId, featureId });
    } else {
      await RestaurantFeature.create({
        restaurantId,
        featureId,
        grantedBy: req.user?.userId ?? null,
      });
      res.json({ enabled: true, restaurantId, featureId });
    }
  } catch {
    res.status(500).json({ error: "Failed to toggle restaurant feature" });
  }
}

// ─── Payments / Transactions ────────────────────────────────────────────────

/**
 * Admin: paginated transaction ledger. Filter by status / provider.
 * GET /api/admin/payments?page=1&pageSize=50&status=PAID&provider=TBC
 */
export async function listPayments(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10) || 50));

    const where: Record<string, unknown> = {};
    const status = String(req.query.status ?? "");
    if (status && (Object.values(PaymentStatus) as string[]).includes(status)) where.status = status;
    const provider = String(req.query.provider ?? "");
    if (provider && (Object.values(PaymentProviderKey) as string[]).includes(provider)) where.provider = provider;

    const { rows, count } = await Payment.findAndCountAll({
      where,
      include: [
        { model: Restaurant, attributes: ["id", "name", "slug"] },
        { model: Plan, attributes: ["id", "name", "slug"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({ data: rows, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) });
  } catch {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
}
