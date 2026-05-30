import { Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { sequelize } from "../lib/database";
import { Reservation, ReservationStatus } from "../models/Reservation";
import { TableModel } from "../models/Table";
import { Floor } from "../models/Floor";
import { Restaurant } from "../models/Restaurant";
import { User } from "../models/User";
import { AuthRequest, getRestaurantForUser, getUserPermissions } from "../middleware/auth";
import { Permission } from "../models/RestaurantStaff";
import { sseBroadcaster } from "../lib/sse";
import {
  sendMail,
  pendingGuestEmail,
  pendingOwnerEmail,
  confirmedGuestEmail,
  rejectedGuestEmail,
  SmtpConfig,
} from "../lib/mailer";
import { decryptSecret } from "../lib/crypto";
import { DEFAULT_DURATION, overlaps } from "../lib/reservationTime";
import { logAudit } from "../lib/audit";

class ConflictError extends Error {}
class NotFoundError extends Error {}

function restaurantSmtp(restaurant: { smtpHost?: string | null; smtpPort?: number | null; smtpUser?: string | null; smtpPass?: string | null }): SmtpConfig | undefined {
  if (restaurant.smtpHost && restaurant.smtpUser && restaurant.smtpPass) {
    let pass: string;
    try {
      pass = decryptSecret(restaurant.smtpPass);
    } catch {
      console.error("[smtp] failed to decrypt SMTP password — skipping custom SMTP");
      return undefined;
    }
    return { host: restaurant.smtpHost, port: restaurant.smtpPort || 587, user: restaurant.smtpUser, pass };
  }
  return undefined;
}

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(d => !isNaN(new Date(d).getTime()), "Invalid date");

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const phoneSchema = z.string().regex(/^\+?[\d\s\-()\s]{7,15}$/);

const createSchema = z.object({
  tableId: z.string(),
  date: dateSchema.refine(d => d >= new Date().toISOString().split("T")[0], "Past dates not accepted"),
  startTime: timeSchema,
  duration: z.number().int().min(15).max(480).default(DEFAULT_DURATION),
  partySize: z.number().int().min(1),
  notes: z.string().max(500).optional(),
  guestName: z.string().min(1).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: phoneSchema.optional(),
});

export async function createReservation(req: AuthRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { tableId, date, startTime, duration, partySize, notes, guestName, guestEmail, guestPhone } = parsed.data;

  if (!req.user && (!guestName || !guestEmail)) {
    res.status(400).json({ error: "Name and email are required for guest reservations" });
    return;
  }

  const table = await TableModel.findByPk(tableId);
  if (!table || !table.isActive) {
    res.status(404).json({ error: "Table not found or inactive" });
    return;
  }
  if (partySize > table.capacity || partySize < table.minCapacity) {
    res.status(400).json({ error: `Party size must be between ${table.minCapacity} and ${table.capacity}` });
    return;
  }

  let reservation!: Reservation;
  try {
    await sequelize.transaction(async (t) => {
      await sequelize.query(
        "SELECT pg_advisory_xact_lock(hashtext(:tableId), hashtext(:date))",
        { replacements: { tableId, date }, transaction: t },
      );
      const existing = await Reservation.findAll({
        where: {
          tableId,
          date,
          status: { [Op.in]: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        },
        attributes: ["startTime", "duration"],
        transaction: t,
      });
      if (existing.some((r) => overlaps(r.startTime, r.duration ?? DEFAULT_DURATION, startTime, duration))) {
        throw new ConflictError("Table already booked for this time");
      }
      reservation = await Reservation.create({
        tableId,
        date,
        startTime,
        duration,
        partySize,
        notes,
        userId: req.user?.userId ?? null,
        guestName: guestName ?? null,
        guestEmail: guestEmail ?? null,
        guestPhone: guestPhone ?? null,
        status: ReservationStatus.PENDING,
      }, { transaction: t });
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      res.status(409).json({ error: (err as Error).message });
      return;
    }
    throw err;
  }

  try {
    const tableWithCtx = await TableModel.findByPk(tableId, {
      include: [{ model: Floor, include: [Restaurant] }],
    });
    const restaurant = tableWithCtx?.floor?.restaurant;
    if (restaurant) {
      let recipientName = "Guest";
      let recipientEmail: string | null = null;
      let recipientPhone = "";
      if (req.user) {
        const u = await User.findByPk(req.user.userId);
        recipientName = guestName || u?.name || "Guest";
        recipientEmail = guestEmail || u?.email || null;
        recipientPhone = guestPhone || u?.phone || "";
      } else {
        recipientName = guestName || "Guest";
        recipientEmail = guestEmail || null;
        recipientPhone = guestPhone || "";
      }

      const ctx = {
        guestName: recipientName,
        restaurantName: restaurant.name,
        tableLabel: tableWithCtx.label,
        date,
        startTime,
        partySize,
      };

      const smtp = restaurantSmtp(restaurant);
      if (recipientEmail) {
        await sendMail({
          to: recipientEmail,
          subject: `Reservation request received — ${restaurant.name}`,
          html: pendingGuestEmail(ctx),
          from: smtp ? (restaurant.email || undefined) : undefined,
          replyTo: smtp ? undefined : (restaurant.email || undefined),
          smtpConfig: smtp,
        });
      }
      const ownerAlertEmail = restaurant.notificationEmail || restaurant.email;
      if (ownerAlertEmail) {
        const contact = [recipientEmail, recipientPhone].filter(Boolean).join(" · ");
        await sendMail({
          to: ownerAlertEmail,
          subject: `New reservation request — Table ${tableWithCtx.label}`,
          html: pendingOwnerEmail({ ...ctx, contact }),
          from: smtp ? (restaurant.email || undefined) : undefined,
          smtpConfig: smtp,
        });
      }

      sseBroadcaster.broadcast(restaurant.id, "new_reservation", {
        id: reservation.id,
        guestName: recipientName,
        date,
        startTime,
        partySize,
        tableLabel: tableWithCtx.label,
      });
    }
  } catch (err) {
    console.error("[reservation:create] notify failed:", err);
  }

  res.status(201).json(reservation);
}

export async function getPublicReservation(req: AuthRequest, res: Response) {
  const { token } = req.params;
  const reservation = await Reservation.findOne({
    where: { confirmationToken: token },
    include: [
      {
        model: TableModel,
        include: [{ model: Floor, include: [Restaurant] }],
      },
      { model: User, attributes: ["name", "email"] },
    ],
  });
  if (!reservation) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }
  const restaurant = reservation.table?.floor?.restaurant;
  res.json({
    id: reservation.id,
    confirmationToken: reservation.confirmationToken,
    date: reservation.date,
    startTime: reservation.startTime,
    partySize: reservation.partySize,
    status: reservation.status,
    notes: reservation.notes,
    guestName: reservation.user?.name || reservation.guestName,
    guestEmail: reservation.user?.email || reservation.guestEmail,
    guestPhone: reservation.guestPhone,
    tableLabel: reservation.table?.label,
    restaurantName: restaurant?.name,
    restaurantAddress: restaurant?.address,
    restaurantPhone: restaurant?.phone,
  });
}

export async function cancelReservationByToken(req: AuthRequest, res: Response) {
  const { token } = req.params;
  const reservation = await Reservation.findOne({ where: { confirmationToken: token } });
  if (!reservation) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }
  if (reservation.status === ReservationStatus.CANCELLED) {
    res.status(400).json({ error: "Already cancelled" });
    return;
  }
  if (reservation.status === ReservationStatus.COMPLETED) {
    res.status(400).json({ error: "Completed reservations cannot be cancelled" });
    return;
  }
  await reservation.update({ status: ReservationStatus.CANCELLED });
  res.json({ status: reservation.status });
}

export async function getUserReservations(req: AuthRequest, res: Response) {
  const reservations = await Reservation.findAll({
    where: { userId: req.user!.userId },
    include: [{ model: TableModel, include: [Floor] }],
    order: [["date", "DESC"], ["startTime", "ASC"]],
  });
  res.json(reservations);
}

export async function cancelReservation(req: AuthRequest, res: Response) {
  const reservation = await Reservation.findOne({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!reservation) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }
  if (reservation.status === ReservationStatus.CANCELLED) {
    res.status(400).json({ error: "Already cancelled" });
    return;
  }
  await reservation.update({ status: ReservationStatus.CANCELLED });
  res.json(reservation);
}

export async function getRestaurantReservations(req: AuthRequest, res: Response) {
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

  const { date, status, search, dateFrom, dateTo, tableId } = req.query as Record<string, string | undefined>;

  const tableWhere: Record<string, unknown> = {};
  if (tableId) tableWhere.id = tableId;

  const where: Record<string, unknown> = {};
  if (date) where.date = date;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    const range: Record<string, string> = {};
    if (dateFrom) range[Op.gte as unknown as string] = dateFrom;
    if (dateTo) range[Op.lte as unknown as string] = dateTo;
    where.date = range;
  }
  if (search) {
    where[Op.or as unknown as string] = [
      { guestName: { [Op.iLike]: `%${search}%` } },
      { guestEmail: { [Op.iLike]: `%${search}%` } },
      { guestPhone: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const reservations = await Reservation.findAll({
    where,
    include: [
      {
        model: TableModel,
        where: Object.keys(tableWhere).length ? tableWhere : undefined,
        include: [{ model: Floor, where: { restaurantId: restaurant.id } }],
      },
      { model: User, attributes: ["id", "name", "email", "phone"] },
    ],
    order: [["date", "ASC"], ["startTime", "ASC"]],
  });
  res.json(reservations);
}

export async function bulkUpdateStatus(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.RESERVATIONS_WRITE)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !Object.values(ReservationStatus).includes(status)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const floors = await Floor.findAll({ where: { restaurantId: restaurant.id }, attributes: ["id"] });
  const tables = await TableModel.findAll({ where: { floorId: floors.map((f) => f.id) }, attributes: ["id"] });
  const tableIds = new Set(tables.map((t) => t.id));

  const reservations = await Reservation.findAll({
    where: { id: { [Op.in]: ids } },
    include: [{ model: TableModel, attributes: ["id"] }],
  });

  const owned = reservations.filter((r) => tableIds.has(r.tableId));
  if (owned.length !== ids.length) {
    res.status(403).json({ error: "Some reservations don't belong to your restaurant" });
    return;
  }

  await Reservation.update({ status }, { where: { id: { [Op.in]: owned.map((r) => r.id) } } });

  sseBroadcaster.broadcast(restaurant.id, "reservations_bulk_updated", {
    ids: owned.map((r) => r.id),
    status,
  });

  res.json({ updated: owned.length });
}

export async function getAvailability(req: AuthRequest, res: Response) {
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

  const { date, startTime } = req.query as Record<string, string | undefined>;
  if (!date) {
    res.status(400).json({ error: "date required" });
    return;
  }

  const floors = await Floor.findAll({
    where: { restaurantId: restaurant.id },
    include: [TableModel],
    order: [["createdAt", "ASC"]],
  });

  const allTableIds = floors.flatMap((f) => (f.tables || []).map((t) => t.id));

  const allReservations = allTableIds.length
    ? await Reservation.findAll({
        where: {
          tableId: { [Op.in]: allTableIds },
          date,
          status: { [Op.in]: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        },
        attributes: ["tableId", "startTime", "duration"],
        order: [["startTime", "ASC"]],
      })
    : [];

  const occupiedIds = new Set<string>();
  const bookingsByTable: Record<string, { startTime: string; duration: number }[]> = {};

  for (const r of allReservations) {
    const tid = r.getDataValue("tableId") as string;
    const rStart = r.getDataValue("startTime") as string;
    const rDuration = (r.getDataValue("duration") as number) ?? DEFAULT_DURATION;

    if (!bookingsByTable[tid]) bookingsByTable[tid] = [];
    bookingsByTable[tid].push({ startTime: rStart, duration: rDuration });

    if (startTime && overlaps(rStart, rDuration, startTime, DEFAULT_DURATION)) {
      occupiedIds.add(tid);
    }
  }

  res.json({
    floors: floors.map((floor) => ({
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

const manualCreateSchema = z.object({
  tableId: z.string(),
  date: dateSchema,
  startTime: timeSchema,
  duration: z.number().int().min(15).max(480).default(DEFAULT_DURATION),
  partySize: z.number().int().min(1),
  notes: z.string().max(500).optional(),
  guestName: z.string().min(1),
  guestPhone: phoneSchema.optional(),
  guestEmail: z.string().email().optional(),
});

export async function createManualReservation(req: AuthRequest, res: Response) {
  const parsed = manualCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { tableId, date, startTime, duration, partySize, notes, guestName, guestPhone, guestEmail } = parsed.data;

  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.RESERVATIONS_WRITE)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const table = await TableModel.findByPk(tableId, { include: [Floor] });
  if (!table || !table.isActive || table.floor?.restaurantId !== restaurant.id) {
    res.status(404).json({ error: "Table not found or inactive" });
    return;
  }
  if (partySize > table.capacity || partySize < table.minCapacity) {
    res.status(400).json({ error: `Party size must be between ${table.minCapacity} and ${table.capacity}` });
    return;
  }

  let manualReservation!: Reservation;
  try {
    await sequelize.transaction(async (t) => {
      await sequelize.query(
        "SELECT pg_advisory_xact_lock(hashtext(:tableId), hashtext(:date))",
        { replacements: { tableId, date }, transaction: t },
      );
      const existingManual = await Reservation.findAll({
        where: {
          tableId,
          date,
          status: { [Op.in]: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        },
        attributes: ["startTime", "duration"],
        transaction: t,
      });
      if (existingManual.some((r) => overlaps(r.startTime, r.duration ?? DEFAULT_DURATION, startTime, duration))) {
        throw new ConflictError("Table already booked for this time");
      }
      manualReservation = await Reservation.create({
        tableId,
        date,
        startTime,
        duration,
        partySize,
        notes: notes ?? null,
        userId: null,
        guestName,
        guestEmail: guestEmail ?? null,
        guestPhone: guestPhone ?? null,
        status: ReservationStatus.CONFIRMED,
      }, { transaction: t });
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      res.status(409).json({ error: (err as Error).message });
      return;
    }
    throw err;
  }

  res.status(201).json(manualReservation);
}

export async function updateReservationStatus(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.RESERVATIONS_WRITE)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const { status } = req.body;
  if (!Object.values(ReservationStatus).includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  let reservation!: Reservation;
  let previousStatus!: ReservationStatus;
  let autoDeclined: Reservation[] = [];
  try {
    await sequelize.transaction(async (t) => {
      const found = await Reservation.findByPk(req.params.id, {
        include: [
          { model: TableModel, include: [{ model: Floor, where: { restaurantId: restaurant.id } }] },
          { model: User, attributes: ["id", "name", "email"] },
        ],
        lock: true,
        transaction: t,
      });
      if (!found) throw new NotFoundError("Reservation not found");
      reservation = found;

      previousStatus = reservation.status;
      await reservation.update({ status }, { transaction: t });

      if (status === ReservationStatus.CONFIRMED && previousStatus !== ReservationStatus.CONFIRMED) {
        const allPending = await Reservation.findAll({
          where: {
            id: { [Op.ne]: reservation.id },
            tableId: reservation.tableId,
            date: reservation.date,
            status: ReservationStatus.PENDING,
          },
          include: [{ model: User, attributes: ["id", "name", "email"] }],
          transaction: t,
        });

        const confirmedDuration = reservation.duration ?? DEFAULT_DURATION;
        const overlapping = allPending.filter((r) =>
          overlaps(r.startTime, r.duration ?? DEFAULT_DURATION, reservation.startTime, confirmedDuration),
        );

        for (const other of overlapping) {
          await other.update({ status: ReservationStatus.CANCELLED }, { transaction: t });
        }
        autoDeclined = overlapping;
      }
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    throw err;
  }

  sseBroadcaster.broadcast(restaurant.id, "reservation_updated", {
    id: reservation.id,
    status,
    guestName: reservation.user?.name || reservation.guestName,
  });
  logAudit({
    userId: req.user!.userId,
    action: "RESERVATION_STATUS_CHANGED",
    resourceType: "reservation",
    resourceId: reservation.id,
    metadata: { from: previousStatus, to: status, autoDeclined: autoDeclined.map((r) => r.id) },
    ip: req.ip,
  });

  try {
    const recipientEmail = reservation.user?.email || reservation.guestEmail;
    const recipientName = reservation.user?.name || reservation.guestName || "Guest";
    if (recipientEmail && status !== previousStatus) {
      const ctx = {
        guestName: recipientName,
        restaurantName: restaurant.name,
        tableLabel: reservation.table?.label || "",
        date: reservation.date,
        startTime: reservation.startTime,
        partySize: reservation.partySize,
      };
      const smtp = restaurantSmtp(restaurant);
      if (status === ReservationStatus.CONFIRMED) {
        await sendMail({
          to: recipientEmail,
          subject: `Reservation confirmed — ${restaurant.name}`,
          html: confirmedGuestEmail(ctx),
          from: smtp ? (restaurant.email || undefined) : undefined,
          replyTo: smtp ? undefined : (restaurant.email || undefined),
          smtpConfig: smtp,
        });
      } else if (status === ReservationStatus.CANCELLED) {
        await sendMail({
          to: recipientEmail,
          subject: `Reservation declined — ${restaurant.name}`,
          html: rejectedGuestEmail(ctx),
          from: smtp ? (restaurant.email || undefined) : undefined,
          replyTo: smtp ? undefined : (restaurant.email || undefined),
          smtpConfig: smtp,
        });
      }
    }

    for (const other of autoDeclined) {
      const otherEmail = other.user?.email || other.guestEmail;
      const otherName = other.user?.name || other.guestName || "Guest";
      if (otherEmail) {
        const ctx = {
          guestName: otherName,
          restaurantName: restaurant.name,
          tableLabel: reservation.table?.label || "",
          date: other.date,
          startTime: other.startTime,
          partySize: other.partySize,
        };
        const smtp = restaurantSmtp(restaurant);
        await sendMail({
          to: otherEmail,
          subject: `Reservation declined — ${restaurant.name}`,
          html: rejectedGuestEmail(ctx),
          from: smtp ? (restaurant.email || undefined) : undefined,
          replyTo: smtp ? undefined : (restaurant.email || undefined),
          smtpConfig: smtp,
        });
      }
    }
  } catch (err) {
    console.error("[reservation:status] notify failed:", err);
  }

  res.json(reservation);
}

export async function getReservationReport(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.REPORTS)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const allReservations = await Reservation.findAll({
    where: { date: { [Op.gte]: today } },
    include: [
      { model: TableModel, include: [{ model: Floor, where: { restaurantId: restaurant.id } }] },
      { model: User, attributes: ["id", "name", "email"] },
    ],
    order: [["date", "ASC"], ["startTime", "ASC"]],
  });

  const stats = { total: 0, pending: 0, confirmed: 0, cancelled: 0, completed: 0, noShow: 0 };
  const daily: Record<string, { total: number; confirmed: number; pending: number; cancelled: number }> = {};

  for (const r of allReservations) {
    stats.total++;
    if (r.status === ReservationStatus.PENDING) stats.pending++;
    else if (r.status === ReservationStatus.CONFIRMED) stats.confirmed++;
    else if (r.status === ReservationStatus.CANCELLED) stats.cancelled++;
    else if (r.status === ReservationStatus.COMPLETED) stats.completed++;
    else if (r.status === ReservationStatus.NO_SHOW) stats.noShow++;

    const d = r.date;
    if (!daily[d]) daily[d] = { total: 0, confirmed: 0, pending: 0, cancelled: 0 };
    daily[d].total++;
    if (r.status === ReservationStatus.CONFIRMED) daily[d].confirmed++;
    if (r.status === ReservationStatus.PENDING) daily[d].pending++;
    if (r.status === ReservationStatus.CANCELLED) daily[d].cancelled++;
  }

  const upcoming = allReservations.filter((r) => r.date <= sevenDaysFromNow).map((r) => ({
    id: r.id,
    date: r.date,
    startTime: r.startTime,
    partySize: r.partySize,
    status: r.status,
    guestName: r.user?.name || r.guestName || "Guest",
    guestEmail: r.user?.email || r.guestEmail || null,
    tableLabel: r.table?.label || null,
  }));

  res.json({ stats, daily, upcoming });
}
