import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 16;
const ENCRYPTED_PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.SMTP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("SMTP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  // Backward compat: plaintext values (not encrypted yet) pass through
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;

  const data = stored.slice(ENCRYPTED_PREFIX.length);
  const parts = data.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted secret format");

  const [ivHex, tagHex, dataHex] = parts;
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
