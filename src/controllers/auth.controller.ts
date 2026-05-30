import crypto from "crypto";
import { Request, Response, CookieOptions } from "express";
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

function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
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

const isProduction = process.env.NODE_ENV === "production";

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, REFRESH_COOKIE_OPTIONS);
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/auth",
  });
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
    // Always respond the same to prevent account enumeration
    res.status(201).json({ message: "Account created. Check your email to verify." });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const rawToken = generateVerificationToken();
  const storedToken = hashToken(rawToken);

  await User.create({
    email,
    password: hashed,
    name,
    phone,
    role,
    emailVerified: false,
    emailVerificationToken: storedToken,
  });

  sendMail({
    to: email,
    subject: "Verify your Mesa email",
    html: verificationEmail(name, rawToken),
  }).catch((e: Error) => console.error("[mail] send failed:", e.message));

  res.status(201).json({ message: "Account created. Check your email to verify." });
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

  if (!user.emailVerified) {
    res.status(403).json({ error: "EMAIL_NOT_VERIFIED" });
    return;
  }

  const payload = { userId: user.id, role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);

  setRefreshCookie(res, refreshToken);

  res.json({
    accessToken,
    user: userPayload(user),
  });
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = (req as Request & { cookies: Record<string, string> }).cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }
  try {
    const payload = verifyRefresh(refreshToken);
    const newPayload = { userId: payload.userId, role: payload.role };
    const newAccessToken = signAccess(newPayload);
    const newRefreshToken = signRefresh(newPayload);

    // Rotate refresh token
    setRefreshCookie(res, newRefreshToken);

    res.json({ accessToken: newAccessToken });
  } catch {
    clearRefreshCookie(res);
    res.status(401).json({ error: "Invalid refresh token" });
  }
}

export function logout(_req: Request, res: Response) {
  clearRefreshCookie(res);
  res.json({ message: "Logged out" });
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

  const hashedToken = hashToken(token);
  const user = await User.findOne({ where: { emailVerificationToken: hashedToken } });
  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification link" });
    return;
  }

  await user.update({ emailVerified: true, emailVerificationToken: null });
  res.json({ message: "Email verified" });
}

export async function resendVerification(req: Request, res: Response) {
  const email = req.body?.email ?? (req as Request & { user?: { userId: string } }).user
    ? await User.findByPk((req as Request & { user?: { userId: string } }).user?.userId).then(u => u?.email)
    : null;

  if (!email) {
    res.status(400).json({ error: "Email required" });
    return;
  }

  const user = await User.findOne({ where: { email } });
  // Always respond the same — don't leak whether email exists
  if (!user || user.emailVerified) {
    res.json({ message: "If that email exists and is unverified, a link has been sent." });
    return;
  }

  const rawToken = generateVerificationToken();
  const storedToken = hashToken(rawToken);
  await user.update({ emailVerificationToken: storedToken });

  sendMail({
    to: user.email,
    subject: "Verify your Mesa email",
    html: verificationEmail(user.name, rawToken),
  }).catch((e: Error) => console.error("[mail] send failed:", e.message));

  res.json({ message: "If that email exists and is unverified, a link has been sent." });
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
  }).catch((e: Error) => console.error("[mail] send failed:", e.message));

  res.json({ message: "Password changed" });
}
