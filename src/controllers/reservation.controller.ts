import { Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { Reservation, ReservationStatus } from "../models/Reservation";
import { TableModel } from "../models/Table";
import { Floor } from "../models/Floor";
import { Restaurant } from "../models/Restaurant";
import { User } from "../models/User";
import { AuthRequest, getRestaurantForUser, getUserPermissions } from "../middleware/auth";
import { Permission } from "../models/RestaurantStaff";
import {
  sendMail,
  pendingGuestEmail,
  pendingOwnerEmail,
  confirmedGuestEmail,
  rejectedGuestEmail,
  SmtpConfig,
} from "../lib/mailer";

function restaurantSmtp(restaurant: { smtpHost?: string | null; smtpPort?: number | null; smtpUser?: string | null; smtpPass?: string | null }): SmtpConfig | undefined {
  if (restaurant.smtpHost && restaurant.smtpUser && restaurant.smtpPass) {
    return { host: restaurant.smtpHost, port: restaurant.smtpPort || 587, user: restaurant.smtpUser, pass: restaurant.smtpPass };
  }
  return undefined;
}

const createSchema = z.object({
  tableId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string(),
  endTime: z.string(),
  partySize: z.number().int().min(1),
  notes: z.string().optional(),
  guestName: z.string().min(1).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
});

export async function createReservation(req: AuthRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { tableId, date, startTime, endTime, partySize, notes, guestName, guestEmail, guestPhone } = parsed.data;

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

  const conflict = await Reservation.findOne({
    where: {
      tableId,
      date,
      status: { [Op.in]: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      [Op.or]: [
        { startTime: { [Op.between]: [startTime, endTime] } },
        { endTime: { [Op.between]: [startTime, endTime] } },
        {
          startTime: { [Op.lte]: startTime },
          endTime: { [Op.gte]: endTime },
        },
      ],
    },
  });
  if (conflict) {
    res.status(409).json({ error: "Table already booked for this time" });
    return;
  }

  const reservation = await Reservation.create({
    tableId,
    date,
    startTime,
    endTime,
    partySize,
    notes,
    userId: req.user?.userId ?? null,
    guestName: guestName ?? null,
    guestEmail: guestEmail ?? null,
    guestPhone: guestPhone ?? null,
    status: ReservationStatus.PENDING,
  });

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
        endTime,
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
    }
  } catch (err) {
    console.error("[reservation:create] notify failed:", err);
  }

  res.status(201).json(reservation);
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

  const { date, status } = req.query;
  const where: Record<string, unknown> = {};
  if (date) where.date = date;
  if (status) where.status = status;

  const reservations = await Reservation.findAll({
    where,
    include: [
      { model: TableModel, where: {}, include: [{ model: Floor, where: { restaurantId: restaurant.id } }] },
      { model: User, attributes: ["id", "name", "email", "phone"] },
    ],
    order: [["date", "ASC"], ["startTime", "ASC"]],
  });
  res.json(reservations);
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

  const { date, startTime, endTime } = req.query as Record<string, string | undefined>;
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

  // Only compute occupied tables when time window is provided
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

  // Fetch all reservations for the date to show booking times per table
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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string(),
  endTime: z.string(),
  partySize: z.number().int().min(1),
  notes: z.string().optional(),
  guestName: z.string().min(1),
  guestPhone: z.string().optional(),
  guestEmail: z.string().email().optional(),
});

export async function createManualReservation(req: AuthRequest, res: Response) {
  const parsed = manualCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { tableId, date, startTime, endTime, partySize, notes, guestName, guestPhone, guestEmail } = parsed.data;

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

  const conflict = await Reservation.findOne({
    where: {
      tableId,
      date,
      status: { [Op.in]: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      [Op.or]: [
        { startTime: { [Op.between]: [startTime, endTime] } },
        { endTime: { [Op.between]: [startTime, endTime] } },
        { startTime: { [Op.lte]: startTime }, endTime: { [Op.gte]: endTime } },
      ],
    },
  });
  if (conflict) {
    res.status(409).json({ error: "Table already booked for this time" });
    return;
  }

  const reservation = await Reservation.create({
    tableId,
    date,
    startTime,
    endTime,
    partySize,
    notes: notes ?? null,
    userId: null,
    guestName,
    guestEmail: guestEmail ?? null,
    guestPhone: guestPhone ?? null,
    status: ReservationStatus.CONFIRMED,
  });

  res.status(201).json(reservation);
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

  const reservation = await Reservation.findByPk(req.params.id, {
    include: [
      { model: TableModel, include: [{ model: Floor, where: { restaurantId: restaurant.id } }] },
      { model: User, attributes: ["id", "name", "email"] },
    ],
  });
  if (!reservation) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }
  const previousStatus = reservation.status;
  await reservation.update({ status });

  // Auto-decline overlapping pending reservations when confirming
  let autoDeclined: Reservation[] = [];
  if (status === ReservationStatus.CONFIRMED && previousStatus !== ReservationStatus.CONFIRMED) {
    const overlapping = await Reservation.findAll({
      where: {
        id: { [Op.ne]: reservation.id },
        tableId: reservation.tableId,
        date: reservation.date,
        status: ReservationStatus.PENDING,
        [Op.or]: [
          { startTime: { [Op.between]: [reservation.startTime, reservation.endTime] } },
          { endTime: { [Op.between]: [reservation.startTime, reservation.endTime] } },
          { startTime: { [Op.lte]: reservation.startTime }, endTime: { [Op.gte]: reservation.endTime } },
        ],
      },
      include: [{ model: User, attributes: ["id", "name", "email"] }],
    });
    for (const other of overlapping) {
      await other.update({ status: ReservationStatus.CANCELLED });
    }
    autoDeclined = overlapping;
  }

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
        endTime: reservation.endTime,
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

    // Notify auto-declined guests
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
          endTime: other.endTime,
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
