import { Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { Reservation } from "../models/Reservation";
import { TableModel } from "../models/Table";
import { Floor } from "../models/Floor";
import { User } from "../models/User";
import { GuestNote } from "../models/GuestNote";
import { AuthRequest, getRestaurantForUser, getUserPermissions } from "../middleware/auth";
import { Permission } from "../models/RestaurantStaff";
import { sequelize } from "../lib/database";

export async function listGuests(req: AuthRequest, res: Response) {
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

  const { search } = req.query as { search?: string };

  const floors = await Floor.findAll({ where: { restaurantId: restaurant.id }, attributes: ["id"] });
  const tables = await TableModel.findAll({ where: { floorId: floors.map((f) => f.id) }, attributes: ["id"] });
  const tableIds = tables.map((t) => t.id);
  if (!tableIds.length) {
    res.json([]);
    return;
  }

  const where: Record<string, unknown> = { tableId: { [Op.in]: tableIds } };
  if (search) {
    where[Op.or as unknown as string] = [
      { guestEmail: { [Op.iLike]: `%${search}%` } },
      { guestName: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const rows = await Reservation.findAll({
    where,
    attributes: [
      "guestEmail", "guestName", "guestPhone", "userId",
      [sequelize.fn("COUNT", sequelize.col("Reservation.id")), "visitCount"],
      [sequelize.fn("MAX", sequelize.col("date")), "lastVisit"],
    ],
    include: [{ model: User, attributes: ["name", "email"] }],
    group: ["guestEmail", "guestName", "guestPhone", "userId", "User.id"],
    order: [[sequelize.literal('"lastVisit"'), "DESC"]],
    raw: false,
  });

  res.json(
    rows.map((r) => ({
      guestEmail: r.guestEmail || r.user?.email,
      guestName: r.guestName || r.user?.name,
      guestPhone: r.guestPhone || r.user?.phone || null,
      userId: r.userId,
      visitCount: (r as unknown as { dataValues: { visitCount: string } }).dataValues.visitCount,
      lastVisit: (r as unknown as { dataValues: { lastVisit: string } }).dataValues.lastVisit,
    }))
  );
}

export async function getGuestHistory(req: AuthRequest, res: Response) {
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

  const { email } = req.params;

  const floors = await Floor.findAll({ where: { restaurantId: restaurant.id }, attributes: ["id"] });
  const tables = await TableModel.findAll({ where: { floorId: floors.map((f) => f.id) }, attributes: ["id"] });
  const tableIds = tables.map((t) => t.id);

  const reservations = await Reservation.findAll({
    where: {
      tableId: { [Op.in]: tableIds },
      [Op.or]: [{ guestEmail: email }, ...(email ? [] : [])],
    },
    include: [
      { model: TableModel, include: [{ model: Floor }] },
      { model: User, attributes: ["name", "email"] },
    ],
    order: [["date", "DESC"]],
  });

  const notes = await GuestNote.findAll({
    where: { restaurantId: restaurant.id, guestEmail: email },
    order: [["createdAt", "DESC"]],
  });

  res.json({ reservations, notes });
}

const noteSchema = z.object({ note: z.string().min(1) });

export async function addGuestNote(req: AuthRequest, res: Response) {
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

  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const note = await GuestNote.create({
    restaurantId: restaurant.id,
    guestEmail: req.params.email,
    note: parsed.data.note,
    authorId: req.user!.userId,
  });
  res.status(201).json(note);
}

export async function deleteGuestNote(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }
  const note = await GuestNote.findOne({ where: { id: req.params.noteId, restaurantId: restaurant.id } });
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  await note.destroy();
  res.status(204).send();
}
