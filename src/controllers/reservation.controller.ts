import { Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { Reservation, ReservationStatus } from "../models/Reservation";
import { TableModel } from "../models/Table";
import { Floor } from "../models/Floor";
import { Restaurant } from "../models/Restaurant";
import { User } from "../models/User";
import { AuthRequest } from "../middleware/auth";

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
    guestName: req.user ? null : (guestName ?? null),
    guestEmail: req.user ? null : (guestEmail ?? null),
    guestPhone: req.user ? null : (guestPhone ?? null),
    status: ReservationStatus.PENDING,
  });
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
  const restaurant = await Restaurant.findOne({ where: { ownerId: req.user!.userId } });
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
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

export async function updateReservationStatus(req: AuthRequest, res: Response) {
  const restaurant = await Restaurant.findOne({ where: { ownerId: req.user!.userId } });
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }

  const { status } = req.body;
  if (!Object.values(ReservationStatus).includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const reservation = await Reservation.findByPk(req.params.id, {
    include: [{ model: TableModel, include: [{ model: Floor, where: { restaurantId: restaurant.id } }] }],
  });
  if (!reservation) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }
  await reservation.update({ status });
  res.json(reservation);
}
