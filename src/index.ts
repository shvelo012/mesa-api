import "reflect-metadata";
import "dotenv/config";
import express from "express";
import "express-async-errors"; // patches Express 4 to forward async handler rejections to the error middleware
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import multer from "multer";
import path from "path";
import { NextFunction, Request, Response } from "express";
import { connectDB } from "./lib/database";
import authRoutes from "./routes/auth.routes";
import restaurantRoutes from "./routes/restaurant.routes";
import floorRoutes from "./routes/floor.routes";
import reservationRoutes from "./routes/reservation.routes";
import menuRoutes from "./routes/menu.routes";
import eventsRoutes from "./routes/events.routes";
import waitlistRoutes from "./routes/waitlist.routes";
import guestRoutes from "./routes/guest.routes";
import reviewRoutes, { restaurantReviewRouter } from "./routes/review.routes";
import adminRoutes from "./routes/admin.routes";
import planRoutes from "./routes/plan.routes";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

if (!process.env.STORAGE_DRIVER || process.env.STORAGE_DRIVER === "local") {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
}

app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/floors", floorRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/guests", guestRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/restaurants/:id/reviews", restaurantReviewRouter);
app.use("/api/admin", adminRoutes);
app.use("/api/plans", planRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// 404 — no route matched
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Terminal error handler — catches sync throws and (via express-async-errors) async rejections.
// Keeps requests from hanging and avoids leaking stack traces to clients.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  // Multer / upload validation errors are client faults → 400
  if (err instanceof multer.MulterError || (err as { status?: number })?.status === 400) {
    res.status(400).json({ error: (err as Error).message || "Bad request" });
    return;
  }
  console.error("[error]", err);
  const status = (err as { status?: number })?.status ?? 500;
  res.status(status).json({ error: status === 500 ? "Internal server error" : (err as Error).message });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });
