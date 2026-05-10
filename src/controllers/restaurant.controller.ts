import { Response } from "express";
import { z } from "zod";
import { Restaurant } from "../models/Restaurant";
import { Floor } from "../models/Floor";
import { AuthRequest } from "../middleware/auth";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  cuisine: z.string().optional(),
  openTime: z.string(),
  closeTime: z.string(),
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

  const restaurant = await Restaurant.create({
    ...parsed.data,
    ownerId: req.user!.userId,
  });
  res.status(201).json(restaurant);
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
  res.json(restaurant);
}

export async function updateRestaurant(req: AuthRequest, res: Response) {
  const restaurant = await Restaurant.findOne({ where: { ownerId: req.user!.userId } });
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await restaurant.update(parsed.data);
  res.json(restaurant);
}

export async function listRestaurants(_req: AuthRequest, res: Response) {
  const restaurants = await Restaurant.findAll({
    attributes: ["id", "name", "description", "address", "cuisine", "openTime", "closeTime"],
  });
  res.json(restaurants);
}

export async function getRestaurantById(req: AuthRequest, res: Response) {
  const restaurant = await Restaurant.findByPk(req.params.id, {
    include: [Floor],
  });
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }
  res.json(restaurant);
}
