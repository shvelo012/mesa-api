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
import { RestaurantStaff } from "../models/RestaurantStaff";
import { Waitlist } from "../models/Waitlist";
import { GuestNote } from "../models/GuestNote";
import { Review } from "../models/Review";
import { Feature } from "../models/Feature";
import { Plan } from "../models/Plan";
import { PlanFeature } from "../models/PlanFeature";
import { Subscription } from "../models/Subscription";
import { RestaurantFeature } from "../models/RestaurantFeature";
import { AuditLog } from "../models/AuditLog";

export const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME!,
  username: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  models: [User, Restaurant, Floor, TableModel, Wall, Reservation, Menu, MenuPhoto, MenuGroup, MenuItem, RestaurantStaff, Waitlist, GuestNote, Review, Feature, Plan, PlanFeature, Subscription, RestaurantFeature, AuditLog],
});

export async function connectDB() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log("Database connected.");
}
