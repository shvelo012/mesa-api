import { Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { Waitlist, WaitlistStatus } from "../models/Waitlist";
import { Restaurant } from "../models/Restaurant";
import { AuthRequest, getRestaurantForUser, getUserPermissions } from "../middleware/auth";
import { Permission } from "../models/RestaurantStaff";
import { sendMail } from "../lib/mailer";

const joinSchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.number().int().min(1),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function joinWaitlist(req: AuthRequest, res: Response) {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { restaurantId, date, partySize, guestName, guestEmail, guestPhone, notes } = parsed.data;

  const restaurant = await Restaurant.findByPk(restaurantId);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }

  const existing = await Waitlist.count({
    where: {
      restaurantId,
      date,
      guestEmail,
      status: { [Op.in]: [WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED] },
    },
  });
  if (existing > 0) {
    res.status(409).json({ error: "Already on waitlist for this date" });
    return;
  }

  const position = await Waitlist.count({
    where: {
      restaurantId,
      date,
      status: { [Op.in]: [WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED] },
    },
  }) + 1;

  const entry = await Waitlist.create({
    restaurantId,
    date,
    partySize,
    guestName,
    guestEmail,
    guestPhone: guestPhone ?? null,
    userId: req.user?.userId ?? null,
    notes: notes ?? null,
    status: WaitlistStatus.WAITING,
    position,
  });

  try {
    await sendMail({
      to: guestEmail,
      subject: `You're on the waitlist — ${restaurant.name}`,
      html: `
        <p>Hi ${guestName},</p>
        <p>You've been added to the waitlist for <strong>${restaurant.name}</strong> on <strong>${date}</strong> for ${partySize} guest${partySize > 1 ? "s" : ""}.</p>
        <p>Your position: <strong>#${position}</strong></p>
        <p>We'll contact you if a table becomes available.</p>
      `,
    });
  } catch {
    // email failure non-fatal
  }

  res.status(201).json(entry);
}

export async function getRestaurantWaitlist(req: AuthRequest, res: Response) {
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

  const { date } = req.query;
  const where: Record<string, unknown> = { restaurantId: restaurant.id };
  if (date) where.date = date;

  const entries = await Waitlist.findAll({
    where,
    order: [["date", "ASC"], ["position", "ASC"]],
  });
  res.json(entries);
}

export async function notifyWaitlistEntry(req: AuthRequest, res: Response) {
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

  const entry = await Waitlist.findOne({ where: { id: req.params.id, restaurantId: restaurant.id } });
  if (!entry) {
    res.status(404).json({ error: "Waitlist entry not found" });
    return;
  }

  await entry.update({ status: WaitlistStatus.NOTIFIED });

  try {
    await sendMail({
      to: entry.guestEmail,
      subject: `A table may be available — ${restaurant.name}`,
      html: `
        <p>Hi ${entry.guestName},</p>
        <p>Good news! A table may have opened up at <strong>${restaurant.name}</strong> on <strong>${entry.date}</strong>.</p>
        <p>Please contact the restaurant directly to confirm your reservation.</p>
        <p>Restaurant phone: ${restaurant.phone}</p>
      `,
    });
  } catch {
    // email failure non-fatal
  }

  res.json(entry);
}

export async function updateWaitlistStatus(req: AuthRequest, res: Response) {
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
  if (!Object.values(WaitlistStatus).includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const entry = await Waitlist.findOne({ where: { id: req.params.id, restaurantId: restaurant.id } });
  if (!entry) {
    res.status(404).json({ error: "Waitlist entry not found" });
    return;
  }

  await entry.update({ status });
  res.json(entry);
}
