import crypto from "crypto";

interface TokenEntry {
  userId: string;
  expiresAt: number;
}

const store = new Map<string, TokenEntry>();

export function createSseToken(userId: string): string {
  const token = crypto.randomUUID();
  store.set(token, { userId, expiresAt: Date.now() + 60_000 });
  for (const [k, v] of store) {
    if (v.expiresAt < Date.now()) store.delete(k);
  }
  return token;
}

export function consumeSseToken(token: string): string | null {
  const entry = store.get(token);
  store.delete(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.userId;
}
