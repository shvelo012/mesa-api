import { Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { Floor, SectionType } from "../models/Floor";
import { TableModel } from "../models/Table";
import { Wall } from "../models/Wall";
import { Reservation, ReservationStatus } from "../models/Reservation";
import { AuthRequest, getRestaurantForUser, getUserPermissions } from "../middleware/auth";
import { Permission } from "../models/RestaurantStaff";
import { sequelize } from "../lib/database";

const floorSchema = z.object({
  name: z.string().min(1),
  sectionType: z.nativeEnum(SectionType).default(SectionType.INDOOR),
  width: z.number().default(800),
  height: z.number().default(600),
  bgColor: z.string().default("#f5f5f0"),
});

const createFloorSchema = floorSchema.extend({
  tables: z.array(
    z.object({
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
      isActive: z.boolean().default(true),
      notes: z.string().nullish(),
      imageUrl: z.string().nullish(),
    })
  ).optional(),
  walls: z.array(
    z.object({
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    })
  ).optional(),
});

export async function createFloor(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.FLOOR_PLAN)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }
  const parsed = createFloorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { tables, walls, ...rest } = parsed.data;
  const floor = await sequelize.transaction(async (transaction) => {
    const created = await Floor.create({ ...rest, restaurantId: restaurant.id }, { transaction });
    if (tables && tables.length) {
      await TableModel.bulkCreate(
        tables.map((t) => ({ ...t, floorId: created.id })),
        { transaction }
      );
    }
    if (walls && walls.length) {
      await Wall.bulkCreate(
        walls.map((w) => ({ ...w, floorId: created.id })),
        { transaction }
      );
    }
    return created;
  });
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
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.FLOOR_PLAN)) {
    res.status(403).json({ error: "Missing permission" });
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
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.FLOOR_PLAN)) {
    res.status(403).json({ error: "Missing permission" });
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
      isActive: z.boolean().default(true),
      notes: z.string().nullish(),
      imageUrl: z.string().nullish(),
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

export async function getLiveStatus(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.RESERVATIONS_READ)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const floors = await Floor.findAll({
    where: { restaurantId: restaurant.id },
    include: [TableModel],
    order: [["createdAt", "ASC"]],
  });

  const allTableIds = floors.flatMap((f) => (f.tables || []).map((t) => t.id));

  const reservations = allTableIds.length
    ? await Reservation.findAll({
        where: {
          tableId: { [Op.in]: allTableIds },
          date,
          status: { [Op.in]: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
        },
        order: [["startTime", "ASC"]],
      })
    : [];

  const tableStatusMap: Record<string, {
    status: "AVAILABLE" | "ARRIVING_SOON" | "OCCUPIED" | "UPCOMING";
    reservation?: { id: string; startTime: string; endTime: string; guestName: string | null; partySize: number };
  }> = {};

  for (const r of reservations) {
    const guestName = r.guestName;
    const entry = {
      id: r.id,
      startTime: r.startTime,
      endTime: r.endTime,
      guestName,
      partySize: r.partySize,
    };

    const isOccupied = r.startTime <= currentTime && r.endTime > currentTime;
    const isArrivingSoon =
      r.startTime > currentTime &&
      r.startTime <= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes() + 30).padStart(2, "0")}`;

    const current = tableStatusMap[r.tableId];
    if (!current || isOccupied || (!current && isArrivingSoon)) {
      tableStatusMap[r.tableId] = {
        status: isOccupied ? "OCCUPIED" : isArrivingSoon ? "ARRIVING_SOON" : "UPCOMING",
        reservation: entry,
      };
    }
  }

  res.json(
    floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      sectionType: floor.sectionType,
      tables: (floor.tables || []).filter((t) => t.isActive).map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        ...(tableStatusMap[t.id] || { status: "AVAILABLE" }),
      })),
    }))
  );
}

export async function saveLayout(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.FLOOR_PLAN)) {
    res.status(403).json({ error: "Missing permission" });
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
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const stripBadId = <T extends { id?: string }>(o: T): Omit<T, "id"> & { id?: string } => {
    const { id, ...rest } = o;
    return id && UUID_RE.test(id) ? { ...rest, id } : rest;
  };

  await TableModel.destroy({ where: { floorId: floor.id } });
  await Wall.destroy({ where: { floorId: floor.id } });

  const createdTables = await TableModel.bulkCreate(
    tables.map((t) => ({ ...stripBadId(t), floorId: floor.id }))
  );
  const createdWalls = await Wall.bulkCreate(
    walls.map((w) => ({ ...stripBadId(w), floorId: floor.id }))
  );

  res.json({ tables: createdTables, walls: createdWalls });
}
