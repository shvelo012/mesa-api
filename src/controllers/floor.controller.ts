import { Response } from "express";
import { z } from "zod";
import { Restaurant } from "../models/Restaurant";
import { Floor, SectionType } from "../models/Floor";
import { TableModel } from "../models/Table";
import { Wall } from "../models/Wall";
import { AuthRequest } from "../middleware/auth";

const floorSchema = z.object({
  name: z.string().min(1),
  sectionType: z.nativeEnum(SectionType).default(SectionType.INDOOR),
  width: z.number().default(800),
  height: z.number().default(600),
  bgColor: z.string().default("#f5f5f0"),
});

async function ownerRestaurant(userId: string) {
  return Restaurant.findOne({ where: { ownerId: userId } });
}

export async function createFloor(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const parsed = floorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const floor = await Floor.create({ ...parsed.data, restaurantId: restaurant.id });
  res.status(201).json(floor);
}

export async function getFloor(req: AuthRequest, res: Response) {
  const floor = await Floor.findByPk(req.params.id, {
    include: [TableModel, Wall],
  });
  if (!floor) {
    res.status(404).json({ error: "Floor not found" });
    return;
  }
  res.json(floor);
}

export async function updateFloor(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const floor = await Floor.findOne({
    where: { id: req.params.id, restaurantId: restaurant.id },
  });
  if (!floor) {
    res.status(404).json({ error: "Floor not found" });
    return;
  }
  const parsed = floorSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await floor.update(parsed.data);
  res.json(floor);
}

export async function deleteFloor(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const floor = await Floor.findOne({
    where: { id: req.params.id, restaurantId: restaurant.id },
  });
  if (!floor) {
    res.status(404).json({ error: "Floor not found" });
    return;
  }
  await floor.destroy();
  res.status(204).send();
}

const saveLayoutSchema = z.object({
  tables: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string(),
      shape: z.enum(["RECTANGLE", "CIRCLE", "SQUARE"]),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      rotation: z.number().default(0),
      capacity: z.number().int().min(1),
      minCapacity: z.number().int().min(1).default(1),
      isWindowSeat: z.boolean().default(false),
      notes: z.string().nullish(),
    })
  ),
  walls: z.array(
    z.object({
      id: z.string().optional(),
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    })
  ),
});

export async function saveLayout(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const floor = await Floor.findOne({
    where: { id: req.params.id, restaurantId: restaurant.id },
  });
  if (!floor) {
    res.status(404).json({ error: "Floor not found" });
    return;
  }

  const parsed = saveLayoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { tables, walls } = parsed.data;

  await TableModel.destroy({ where: { floorId: floor.id } });
  await Wall.destroy({ where: { floorId: floor.id } });

  const createdTables = await TableModel.bulkCreate(
    tables.map((t) => ({ ...t, floorId: floor.id }))
  );
  const createdWalls = await Wall.bulkCreate(
    walls.map((w) => ({ ...w, floorId: floor.id }))
  );

  res.json({ tables: createdTables, walls: createdWalls });
}
