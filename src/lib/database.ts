import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import { User } from "../models/User";
import { Restaurant } from "../models/Restaurant";
import { Floor } from "../models/Floor";
import { TableModel } from "../models/Table";
import { Wall } from "../models/Wall";
import { Reservation } from "../models/Reservation";
import { Menu } from "../models/Menu";
import { MenuPhoto } from "../models/MenuPhoto";
import { MenuGroup } from "../models/MenuGroup";
import { MenuItem } from "../models/MenuItem";

export const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME!,
  username: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  models: [User, Restaurant, Floor, TableModel, Wall, Reservation, Menu, MenuPhoto, MenuGroup, MenuItem],
});

export async function connectDB() {
  await sequelize.authenticate();
  console.log("Database connected.");
}
