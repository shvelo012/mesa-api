import { Response, Request } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { Restaurant } from "../models/Restaurant";
import { Floor } from "../models/Floor";
import { TableModel } from "../models/Table";
import { Reservation, ReservationStatus } from "../models/Reservation";
import { AuthRequest, getRestaurantForUser, getUserPermissions } from "../middleware/auth";
import { Permission, RestaurantStaff } from "../models/RestaurantStaff";

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
  if (restaurant) {
    res.json(sanitize(restaurant));
    return;
  }
  const staffRecord = await RestaurantStaff.findOne({
    where: { userId: req.user!.userId, isActive: true },
    include: [
      {
        model: Restaurant,
        include: [Floor],
      },
    ],
  });
  if (staffRecord?.restaurant) {
    res.json(sanitize(staffRecord.restaurant));
    return;
  }
  res.status(404).json({ error: "No restaurant found" });
}

export async function getMyRestaurants(req: AuthRequest, res: Response) {
  const owned = await Restaurant.findOne({ where: { ownerId: req.user!.userId } });
  const staffRestaurants = await Restaurant.findAll({
    include: [
      {
        model: Floor,
        required: false,
      },
    ],
    where: {
      id: {
        [Op.in]: (
          await Restaurant.findAll({
            include: [
              {
                association: "staff",
                required: true,
                where: { userId: req.user!.userId, isActive: true },
              },
            ],
          })
        ).map((r) => r.id),
      },
    },
  });

  const all = [];
  if (owned) {
    const perms = Object.values(Permission);
    all.push({ ...sanitize(owned), isOwner: true, permissions: perms });
  }
  for (const r of staffRestaurants) {
    if (owned && r.id === owned.id) continue;
    const perms = await getUserPermissions(req.user!.userId, r.id);
    all.push({ ...sanitize(r), isOwner: false, permissions: perms });
  }

  res.json(all);
}

export async function updateRestaurant(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.SETTINGS_WRITE)) {
    res.status(403).json({ error: "Missing permission" });
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

export async function getPublicAvailability(req: Request, res: Response) {
  const { idOrSlug } = req.params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const restaurant = isUuid
    ? await Restaurant.findByPk(idOrSlug, { include: [{ model: Floor, include: [TableModel] }] })
    : await Restaurant.findOne({ where: { slug: idOrSlug }, include: [{ model: Floor, include: [TableModel] }] });
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }

  const { date, startTime, endTime } = req.query as Record<string, string | undefined>;
  if (!date) {
    res.status(400).json({ error: "date required" });
    return;
  }

  const allTableIds = (restaurant.floors || []).flatMap((f) => (f.tables || []).map((t) => t.id).filter(Boolean));

  // Occupied tables for the requested time window
  let occupiedIds = new Set<string>();
  if (startTime && endTime && allTableIds.length) {
    const occupied = await Reservation.findAll({
      where: {
        tableId: { [Op.in]: allTableIds },
        date,
        status: { [Op.in]: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        [Op.or]: [
          { startTime: { [Op.between]: [startTime, endTime] } },
          { endTime: { [Op.between]: [startTime, endTime] } },
          { startTime: { [Op.lte]: startTime }, endTime: { [Op.gte]: endTime } },
        ],
      },
      attributes: ["tableId"],
    });
    occupiedIds = new Set(occupied.map((r) => r.tableId));
  }

  // All reservations for the date (for tooltip bookings list)
  const allReservations = allTableIds.length
    ? await Reservation.findAll({
        where: {
          tableId: { [Op.in]: allTableIds },
          date,
          status: { [Op.in]: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        },
        attributes: ["tableId", "startTime", "endTime"],
        order: [["startTime", "ASC"]],
      })
    : [];

  const bookingsByTable: Record<string, { startTime: string; endTime: string }[]> = {};
  for (const r of allReservations) {
    const tid = r.getDataValue("tableId") as string;
    if (!bookingsByTable[tid]) bookingsByTable[tid] = [];
    bookingsByTable[tid].push({
      startTime: r.getDataValue("startTime") as string,
      endTime: r.getDataValue("endTime") as string,
    });
  }

  res.json({
    floors: (restaurant.floors || []).map((floor) => ({
      id: floor.id,
      name: floor.name,
      sectionType: floor.sectionType,
      tables: (floor.tables || [])
        .filter((t) => t.isActive)
        .map((t) => ({
          id: t.id,
          label: t.label,
          capacity: t.capacity,
          minCapacity: t.minCapacity,
          isWindowSeat: t.isWindowSeat,
          shape: t.shape,
          available: !occupiedIds.has(t.id),
          bookings: bookingsByTable[t.id] || [],
        })),
    })),
  });
}
