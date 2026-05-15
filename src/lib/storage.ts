import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Request } from "express";

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || "local";
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "menus");

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
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const memoryStorage = multer.memoryStorage();

export const upload = multer({
  storage: STORAGE_DRIVER === "s3" ? memoryStorage : diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: Request, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files allowed"));
      return;
    }
    cb(null, true);
  },
});

export async function saveFile(file: Express.Multer.File): Promise<string> {
  if (STORAGE_DRIVER === "s3") {
    const bucket = process.env.DO_SPACES_BUCKET!;
    const key = `menus/${uuidv4()}${path.extname(file.originalname)}`;
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
