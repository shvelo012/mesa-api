import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Request } from "express";

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || "local";
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "menus");

// Allowlist of accepted image types → safe stored extension.
// SVG is intentionally excluded: it can embed <script> and execute as XSS
// when served inline. The stored extension is derived from this map, never
// from the client-supplied originalname.
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function safeExt(mimetype: string): string {
  return ALLOWED_TYPES[mimetype] ?? "";
}

if (STORAGE_DRIVER === "local" && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const s3 = STORAGE_DRIVER === "s3"
  ? new S3Client({
      endpoint: process.env.DO_SPACES_ENDPOINT,
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY!,
        secretAccessKey: process.env.DO_SPACES_SECRET!,
      },
    })
  : null;

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Extension comes from the validated mimetype, not the client filename.
    cb(null, `${uuidv4()}${safeExt(file.mimetype)}`);
  },
});

const memoryStorage = multer.memoryStorage();

export const upload = multer({
  storage: STORAGE_DRIVER === "s3" ? memoryStorage : diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: Request, file, cb) => {
    if (!(file.mimetype in ALLOWED_TYPES)) {
      const err = new Error("Unsupported file type. Allowed: JPEG, PNG, WebP") as Error & { status?: number };
      err.status = 400;
      cb(err);
      return;
    }
    cb(null, true);
  },
});

export async function saveFile(file: Express.Multer.File): Promise<string> {
  if (STORAGE_DRIVER === "s3") {
    const bucket = process.env.DO_SPACES_BUCKET!;
    const key = `menus/${uuidv4()}${safeExt(file.mimetype)}`;
    await s3!.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read",
    }));
    const endpoint = process.env.DO_SPACES_ENDPOINT!.replace("https://", "");
    return `https://${bucket}.${endpoint}/${key}`;
  }
  // local: file already saved by diskStorage, return URL path
  return `/uploads/menus/${file.filename}`;
}

export async function deleteFile(url: string): Promise<void> {
  if (STORAGE_DRIVER === "s3") {
    const bucket = process.env.DO_SPACES_BUCKET!;
    const key = url.split(`${bucket}/`)[1];
    if (key) {
      await s3!.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
    return;
  }
  // local: delete from disk
  const filename = path.basename(url);
  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
