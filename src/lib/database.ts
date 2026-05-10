import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import { User } from "../models/User";
import { Restaurant } from "../models/Restaurant";
import { Floor } from "../models/Floor";
import { TableModel } from "../models/Table";
import { Wall } from "../models/Wall";
import { Reservation } from "../models/Reservation";

export const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  models: [User, Restaurant, Floor, TableModel, Wall, Reservation],
});

export async function connectDB() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log("Database connected and synced.");
}
