import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Op } from "sequelize";
import { AuthRequest } from "../middleware/auth";
import { getRestaurantForUser, getUserPermissions } from "../middleware/auth";
import { User } from "../models/User";
import { Restaurant } from "../models/Restaurant";
import { RestaurantStaff, StaffRole, Permission, ROLE_PERMISSIONS } from "../models/RestaurantStaff";
import { sendMail } from "../lib/mailer";
import { signAccess, signRefresh } from "../lib/jwt";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.nativeEnum(StaffRole).default(StaffRole.CUSTOM),
  permissions: z.array(z.nativeEnum(Permission)).optional(),
});

const updateSchema = z.object({
  role: z.nativeEnum(StaffRole).optional(),
  permissions: z.array(z.nativeEnum(Permission)).optional(),
  isActive: z.boolean().optional(),
});

function resolvePermissions(role: StaffRole, customPermissions?: Permission[]): Permission[] {
  if (role === StaffRole.CUSTOM && customPermissions) return customPermissions;
  return ROLE_PERMISSIONS[role] || [];
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function inviteUrl(token: string): string {
  const base = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${base}/activate?token=${token}`;
}

export async function inviteStaff(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }

  // Only owner or staff with STAFF_MANAGE can invite
  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.STAFF_MANAGE)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, name, role, permissions } = parsed.data;

  // Prevent inviting the owner
  const owner = await User.findByPk(restaurant.ownerId);
  if (owner && owner.email === email) {
    res.status(400).json({ error: "Cannot invite the owner" });
    return;
  }

  let user = await User.findOne({ where: { email } });
  let activationToken: string | null = null;

  if (!user) {
    // Create a placeholder user with a random password
    const randomPassword = crypto.randomBytes(16).toString("hex");
    activationToken = generateToken();
    user = await User.create({
      email,
      name,
      password: await bcrypt.hash(randomPassword, 12),
      role: "USER" as const,
    });
  } else {
    // Check if already a staff member
    const existing = await RestaurantStaff.findOne({
      where: { userId: user.id, restaurantId: restaurant.id },
    });
    if (existing) {
      res.status(409).json({ error: "User is already a staff member" });
      return;
    }
  }

  const staff = await RestaurantStaff.create({
    userId: user.id,
    restaurantId: restaurant.id,
    role,
    permissions: resolvePermissions(role, permissions),
    isActive: true,
    invitedBy: req.user!.userId,
    activationToken,
  });

  // Send invitation email
  const url = activationToken ? inviteUrl(activationToken) : `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;
  try {
    await sendMail({
      to: email,
      subject: `You've been invited to join ${restaurant.name} on Mesa`,
      html: `
        <p>Hi ${name},</p>
        <p>You've been invited to join <strong>${restaurant.name}</strong> as a staff member on Mesa.</p>
        <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#c4410c;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">${activationToken ? "Set your password" : "Sign in"}</a></p>
        <p style="font-size:12px;color:#9a9088;">If the button doesn't work, copy this link: ${url}</p>
      `,
    });
  } catch (err) {
    console.error("[staff:invite] email failed:", err);
  }

  res.status(201).json({
    id: staff.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: staff.role,
    permissions: staff.permissions,
    isActive: staff.isActive,
    activationPending: !!activationToken,
  });
}

export async function listStaff(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }

  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.STAFF_MANAGE)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const staff = await RestaurantStaff.findAll({
    where: { restaurantId: restaurant.id },
    include: [{ model: User, attributes: ["id", "email", "name", "phone"] }],
    order: [["createdAt", "DESC"]],
  });

  res.json(
    staff.map((s) => ({
      id: s.id,
      userId: s.userId,
      email: s.user?.email,
      name: s.user?.name,
      phone: s.user?.phone,
      role: s.role,
      permissions: s.permissions,
      isActive: s.isActive,
      invitedBy: s.invitedBy,
      activationPending: !!s.activationToken,
      createdAt: s.createdAt,
    }))
  );
}

export async function updateStaff(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }

  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.STAFF_MANAGE)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const staff = await RestaurantStaff.findOne({
    where: { id: req.params.staffId, restaurantId: restaurant.id },
  });
  if (!staff) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }

  const updates: Partial<RestaurantStaff> = {};
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.permissions !== undefined) {
    updates.permissions = resolvePermissions(updates.role || staff.role, parsed.data.permissions);
  } else if (parsed.data.role !== undefined) {
    updates.permissions = resolvePermissions(parsed.data.role, []);
  }

  await staff.update(updates);
  res.json(staff);
}

export async function removeStaff(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant found" });
    return;
  }

  const perms = await getUserPermissions(req.user!.userId, restaurant.id);
  if (!perms.includes(Permission.STAFF_MANAGE)) {
    res.status(403).json({ error: "Missing permission" });
    return;
  }

  const staff = await RestaurantStaff.findOne({
    where: { id: req.params.staffId, restaurantId: restaurant.id },
  });
  if (!staff) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }

  await staff.destroy();
  res.status(204).send();
}

const activateSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function activateStaffAccount(req: Request, res: Response) {
  const parsed = activateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { token, password } = parsed.data;

  const staff = await RestaurantStaff.findOne({
    where: { activationToken: token },
    include: [User],
  });
  if (!staff) {
    res.status(400).json({ error: "Invalid or expired activation token" });
    return;
  }

  await staff.user!.update({ password: await bcrypt.hash(password, 12) });
  await staff.update({ activationToken: null });

  const payload = { userId: staff.user!.id, role: staff.user!.role };
  res.json({
    accessToken: signAccess(payload),
    refreshToken: signRefresh(payload),
    user: { id: staff.user!.id, email: staff.user!.email, name: staff.user!.name, role: staff.user!.role },
  });
}
