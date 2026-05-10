import "reflect-metadata";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./lib/database";
import authRoutes from "./routes/auth.routes";
import restaurantRoutes from "./routes/restaurant.routes";
import floorRoutes from "./routes/floor.routes";
import reservationRoutes from "./routes/reservation.routes";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/floors", floorRoutes);
app.use("/api/reservations", reservationRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });
