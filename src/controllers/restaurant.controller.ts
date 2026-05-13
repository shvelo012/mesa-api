import { Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { Restaurant } from "../models/Restaurant";
import { Floor } from "../models/Floor";
import { AuthRequest } from "../middleware/auth";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const existing = await Restaurant.findAll({
    where: { slug: { [Op.like]: `${base}%` } },
    attributes: ["slug"],
  });
  if (!existing.length) return base;
  const taken = new Set(existing.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function sanitize(restaurant: Restaurant) {
  const json = restaurant.toJSON() as Record<string, unknown>;
  json.smtpConfigured = !!(json.smtpHost && json.smtpUser && json.smtpPass);
  delete json.smtpPass;
  return json;
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  notificationEmail: z.string().email().optional().nullable(),
  cuisine: z.string().optional(),
  openTime: z.string(),
  closeTime: z.string(),
});

const updateSchema = createSchema.partial().extend({
  smtpHost: z.string().min(1).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().min(1).optional().nullable(),
  smtpPass: z.string().min(1).optional().nullable(),
});

export async function createRestaurant(req: AuthRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await Restaurant.findOne({ where: { ownerId: req.user!.userId } });
  if (existing) {
    res.status(409).json({ error: "Already have a restaurant" });
    return;
  }

  const slug = await uniqueSlug(toSlug(parsed.data.name));
  const restaurant = await Restaurant.create({
    ...parsed.data,
    slug,
    ownerId: req.user!.userId,
  });
  res.status(201).json(sanitize(restaurant));
}

export async function getMyRestaurant(req: AuthRequest, res: Response) {
  const restaurant = await Restaurant.findOne({
    where: { ownerId: req.user!.userId },
    include: [Floor],
  });
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  res.json(sanitize(restaurant));
}

export async function updateRestaurant(req: AuthRequest, res: Response) {
  const restaurant = await Restaurant.findOne({ where: { ownerId: req.user!.userId } });
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const updates = { ...parsed.data };
  // Don't wipe existing password if not provided in this request
  if (!("smtpPass" in req.body)) {
    delete updates.smtpPass;
  }

  await restaurant.update(updates);
  res.json(sanitize(restaurant));
}

export async function listRestaurants(_req: AuthRequest, res: Response) {
  const restaurants = await Restaurant.findAll({
    attributes: ["id", "slug", "name", "description", "address", "cuisine", "openTime", "closeTime"],
  });
  res.json(restaurants);
}

export async function getRestaurantById(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const restaurant = isUuid
    ? await Restaurant.findByPk(id, { include: [Floor] })
    : await Restaurant.findOne({ where: { slug: id }, include: [Floor] });
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }
  res.json(restaurant);
}
