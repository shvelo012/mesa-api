import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, Role } from "../models/User";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum([Role.USER, Role.RESTAURANT_OWNER]).default(Role.USER),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password, name, phone, role } = parsed.data;

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({ email, password: hashed, name, phone, role });

  const payload = { userId: user.id, role: user.role };
  res.status(201).json({
    accessToken: signAccess(payload),
    refreshToken: signRefresh(payload),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const user = await User.findOne({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const payload = { userId: user.id, role: user.role };
  res.json({
    accessToken: signAccess(payload),
    refreshToken: signRefresh(payload),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token required" });
    return;
  }
  try {
    const payload = verifyRefresh(refreshToken);
    res.json({ accessToken: signAccess({ userId: payload.userId, role: payload.role }) });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
}

export async function me(req: Request & { user?: { userId: string } }, res: Response) {
  const user = await User.findByPk(req.user!.userId, {
    attributes: { exclude: ["password"] },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
}
