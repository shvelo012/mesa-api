import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export interface JwtPayload {
  userId: string;
  role: string;
}

export const signAccess = (payload: JwtPayload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });

export const signRefresh = (payload: JwtPayload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });

export const verifyAccess = (token: string) =>
  jwt.verify(token, ACCESS_SECRET) as JwtPayload;

export const verifyRefresh = (token: string) =>
  jwt.verify(token, REFRESH_SECRET) as JwtPayload;
