import crypto from "crypto";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, Role } from "../models/User";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt";
import { sendMail, verificationEmail, passwordChangedEmail } from "../lib/mailer";

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

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function userPayload(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

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
  const token = generateVerificationToken();
  const user = await User.create({
    email,
    password: hashed,
    name,
    phone,
    role,
    emailVerified: false,
    emailVerificationToken: token,
  });

  sendMail({
    to: email,
    subject: "Verify your Mesa email",
    html: verificationEmail(name, token),
  }).catch(() => {});

  const payload = { userId: user.id, role: user.role };
  res.status(201).json({
    accessToken: signAccess(payload),
    refreshToken: signRefresh(payload),
    user: userPayload(user),
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
    user: userPayload(user),
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
    attributes: { exclude: ["password", "emailVerificationToken"] },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token required" });
    return;
  }

  const user = await User.findOne({ where: { emailVerificationToken: token } });
  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification link" });
    return;
  }

  await user.update({ emailVerified: true, emailVerificationToken: null });
  res.json({ message: "Email verified" });
}

export async function resendVerification(req: Request & { user?: { userId: string } }, res: Response) {
  const user = await User.findByPk(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.emailVerified) {
    res.status(400).json({ error: "Email already verified" });
    return;
  }

  const token = generateVerificationToken();
  await user.update({ emailVerificationToken: token });

  sendMail({
    to: user.email,
    subject: "Verify your Mesa email",
    html: verificationEmail(user.name, token),
  }).catch(() => {});

  res.json({ message: "Verification email sent" });
}

export async function changePassword(req: Request & { user?: { userId: string } }, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await User.findByPk(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await user.update({ password: hashed });

  sendMail({
    to: user.email,
    subject: "Your Mesa password was changed",
    html: passwordChangedEmail(user.name),
  }).catch(() => {});

  res.json({ message: "Password changed" });
}
