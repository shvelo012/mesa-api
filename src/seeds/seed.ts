import "reflect-metadata";
import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB, sequelize } from "../lib/database";
import { User, Role } from "../models/User";
import { Restaurant } from "../models/Restaurant";
import { Floor, SectionType } from "../models/Floor";
import { TableModel, TableShape } from "../models/Table";
import { Wall } from "../models/Wall";
import { Reservation, ReservationStatus } from "../models/Reservation";
import { Menu, MenuType, LayoutStyle } from "../models/Menu";
import { MenuGroup } from "../models/MenuGroup";
import { MenuItem } from "../models/MenuItem";
import { RestaurantStaff, StaffRole, ROLE_PERMISSIONS } from "../models/RestaurantStaff";
import { Review } from "../models/Review";
import { Feature } from "../models/Feature";
import { Plan } from "../models/Plan";
import { PlanFeature } from "../models/PlanFeature";
import { Subscription, SubscriptionStatus } from "../models/Subscription";
import { RestaurantFeature } from "../models/RestaurantFeature";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split("T")[0];
}

async function seed() {
  await sequelize.authenticate();
  await sequelize.query('DROP TABLE IF EXISTS restaurant_staff CASCADE');
  await sequelize.query('DROP TABLE IF EXISTS waitlists CASCADE');
  await sequelize.query('DROP TABLE IF EXISTS guest_notes CASCADE');
  await connectDB();

  // wipe in dependency order
  await RestaurantFeature.destroy({ where: {} });
  await Subscription.destroy({ where: {} });
  await PlanFeature.destroy({ where: {} });
  await Plan.destroy({ where: {} });
  await Feature.destroy({ where: {} });
  await Review.destroy({ where: {} });
  await Reservation.destroy({ where: {} });
  await Wall.destroy({ where: {} });
  await TableModel.destroy({ where: {} });
  await Floor.destroy({ where: {} });
  await MenuItem.destroy({ where: {} });
  await MenuGroup.destroy({ where: {} });
  await Menu.destroy({ where: {} });
  await Restaurant.destroy({ where: {} });
  await User.destroy({ where: {} });

  console.log("Cleared existing data.");

  // ── users ──────────────────────────────────────────────
  const ownerPw = await bcrypt.hash("password123", 12);
  const userPw  = await bcrypt.hash("password123", 12);

  const [owner1, owner2, owner3] = await User.bulkCreate([
    { email: "owner@example.com",   password: ownerPw, name: "Marco Rossi",    phone: "+1-555-0100", role: Role.RESTAURANT_OWNER, emailVerified: true },
    { email: "owner2@example.com",  password: ownerPw, name: "Yuki Tanaka",    phone: "+1-555-0101", role: Role.RESTAURANT_OWNER, emailVerified: true },
    { email: "owner3@example.com",  password: ownerPw, name: "Claire Dubois",  phone: "+1-555-0102", role: Role.RESTAURANT_OWNER, emailVerified: true },
  ]);

  const [alice, bob, carol] = await User.bulkCreate([
    { email: "alice@example.com",   password: userPw, name: "Alice Johnson",   phone: "+1-555-0201", role: Role.USER, emailVerified: true },
    { email: "bob@example.com",     password: userPw, name: "Bob Smith",       phone: "+1-555-0202", role: Role.USER, emailVerified: true },
    { email: "carol@example.com",   password: userPw, name: "Carol White",     phone: "+1-555-0203", role: Role.USER, emailVerified: true },
  ]);

  const staffUsers = await User.bulkCreate([
    { email: "manager@example.com", password: ownerPw, name: "Sofia Manager",  phone: "+1-555-0301", role: Role.USER },
    { email: "host@example.com",    password: ownerPw, name: "Luca Host",      phone: "+1-555-0302", role: Role.USER },
    { email: "waiter@example.com",  password: ownerPw, name: "Elena Waiter",   phone: "+1-555-0303", role: Role.USER },
  ]);

  const adminPw = await bcrypt.hash("AdminMes@", 12);
  await User.create({
    email: "admin@mesa.com",
    password: adminPw,
    name: "Mesa Admin",
    role: Role.ADMIN,
    emailVerified: true,
  });

  console.log("Users created.");

  // ── restaurant 1: La Bella Vita (Italian) ──────────────
  const r1 = await Restaurant.create({
    name: "La Bella Vita",
    slug: "la-bella-vita",
    description: "Authentic Italian cuisine in the heart of the city. Family recipes passed down for generations.",
    address: "123 Via Roma, Downtown",
    phone: "+1-555-0199",
    email: "info@labellavita.com",
    cuisine: "Italian",
    openTime: "11:00",
    closeTime: "23:00",
    reservationTimes: ["12:00", "13:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"],
    ownerId: owner1.id,
  });

  // ── restaurant 2: Sakura Garden (Japanese) ─────────────
  const r2 = await Restaurant.create({
    name: "Sakura Garden",
    slug: "sakura-garden",
    description: "Modern Japanese dining with traditional omakase experience. Seasonal ingredients, minimalist presentation.",
    address: "88 Blossom Lane, Midtown",
    phone: "+1-555-0299",
    email: "hello@sakuragarden.com",
    cuisine: "Japanese",
    openTime: "12:00",
    closeTime: "22:30",
    reservationTimes: ["12:00", "12:30", "19:00", "19:30", "20:00", "20:30"],
    ownerId: owner2.id,
  });

  // ── restaurant 3: Brasserie Lyon (French) ──────────────
  const r3 = await Restaurant.create({
    name: "Brasserie Lyon",
    slug: "brasserie-lyon",
    description: "Classic French brasserie with a warm, convivial atmosphere. Bistro steak, fresh oysters, and an exceptional wine list.",
    address: "45 Rue du Marché, Uptown",
    phone: "+1-555-0399",
    email: "bonjour@brasserielyon.com",
    cuisine: "French",
    openTime: "10:00",
    closeTime: "23:30",
    reservationTimes: ["10:00", "12:00", "13:00", "18:00", "19:00", "19:30", "20:00", "21:00"],
    ownerId: owner3.id,
  });

  console.log("Restaurants created.");

  // ── staff for r1 ──────────────────────────────────────
  await RestaurantStaff.bulkCreate([
    { userId: staffUsers[0].id, restaurantId: r1.id, role: StaffRole.MANAGER, permissions: ROLE_PERMISSIONS[StaffRole.MANAGER], isActive: true, invitedBy: owner1.id },
    { userId: staffUsers[1].id, restaurantId: r1.id, role: StaffRole.HOST,    permissions: ROLE_PERMISSIONS[StaffRole.HOST],    isActive: true, invitedBy: owner1.id },
    { userId: staffUsers[2].id, restaurantId: r1.id, role: StaffRole.WAITER,  permissions: ROLE_PERMISSIONS[StaffRole.WAITER],  isActive: true, invitedBy: owner1.id },
  ]);

  console.log("Staff created.");

  // ── photo urls ────────────────────────────────────────
  const PHOTO = {
    window2:  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=720&q=70",
    window4:  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=720&q=70",
    round:    "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=720&q=70",
    long:     "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=720&q=70",
    bar:      "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=720&q=70",
    private:  "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=720&q=70",
    outdoor2: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=720&q=70",
    outdoor4: "https://images.unsplash.com/photo-1485872299712-0c89cdc8c4d2?w=720&q=70",
    outdoor6: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=720&q=70",
    japanese: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=720&q=70",
    sushi:    "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=720&q=70",
    french:   "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=720&q=70",
  };

  // ═══════════════════════════════════════════════════════
  // FLOORS & TABLES — R1 (La Bella Vita)
  // ═══════════════════════════════════════════════════════
  const r1Indoor = await Floor.create({ name: "Main Hall", sectionType: SectionType.INDOOR, width: 800, height: 600, bgColor: "#faf7f2", restaurantId: r1.id });
  const r1Terrace = await Floor.create({ name: "Terrace",  sectionType: SectionType.OUTDOOR, width: 700, height: 500, bgColor: "#ecfdf5", restaurantId: r1.id });

  await Wall.bulkCreate([
    { x1: 0,   y1: 0,   x2: 800, y2: 0,   floorId: r1Indoor.id },
    { x1: 800, y1: 0,   x2: 800, y2: 600, floorId: r1Indoor.id },
    { x1: 800, y1: 600, x2: 0,   y2: 600, floorId: r1Indoor.id },
    { x1: 0,   y1: 600, x2: 0,   y2: 0,   floorId: r1Indoor.id },
    { x1: 400, y1: 0,   x2: 400, y2: 200, floorId: r1Indoor.id },
  ]);
  await Wall.bulkCreate([
    { x1: 0,   y1: 0,   x2: 700, y2: 0,   floorId: r1Terrace.id },
    { x1: 700, y1: 0,   x2: 700, y2: 500, floorId: r1Terrace.id },
    { x1: 700, y1: 500, x2: 0,   y2: 500, floorId: r1Terrace.id },
    { x1: 0,   y1: 500, x2: 0,   y2: 0,   floorId: r1Terrace.id },
  ]);

  const r1IndoorTables = await TableModel.bulkCreate([
    { label: "T1", shape: TableShape.RECTANGLE, x: 50,  y: 60,  width: 100, height: 70,  rotation: 0, capacity: 4, minCapacity: 1, isWindowSeat: true,  isActive: true, notes: "Overlooks the street", imageUrl: PHOTO.window4,  floorId: r1Indoor.id },
    { label: "T2", shape: TableShape.RECTANGLE, x: 200, y: 60,  width: 100, height: 70,  rotation: 0, capacity: 4, minCapacity: 1, isWindowSeat: true,  isActive: true, imageUrl: PHOTO.window4,  floorId: r1Indoor.id },
    { label: "T3", shape: TableShape.CIRCLE,    x: 50,  y: 220, width: 90,  height: 90,  rotation: 0, capacity: 3, minCapacity: 1, isWindowSeat: false, isActive: true, imageUrl: PHOTO.round,    floorId: r1Indoor.id },
    { label: "T4", shape: TableShape.CIRCLE,    x: 200, y: 220, width: 90,  height: 90,  rotation: 0, capacity: 3, minCapacity: 1, isWindowSeat: false, isActive: true, imageUrl: PHOTO.round,    floorId: r1Indoor.id },
    { label: "T5", shape: TableShape.RECTANGLE, x: 50,  y: 380, width: 120, height: 80,  rotation: 0, capacity: 6, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.long,     floorId: r1Indoor.id },
    { label: "T6", shape: TableShape.RECTANGLE, x: 220, y: 380, width: 120, height: 80,  rotation: 0, capacity: 6, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.long,     floorId: r1Indoor.id },
    { label: "B1", shape: TableShape.SQUARE,    x: 470, y: 60,  width: 70,  height: 70,  rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Bar counter seat", imageUrl: PHOTO.bar,      floorId: r1Indoor.id },
    { label: "B2", shape: TableShape.SQUARE,    x: 580, y: 60,  width: 70,  height: 70,  rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Bar counter seat", imageUrl: PHOTO.bar,      floorId: r1Indoor.id },
    { label: "P1", shape: TableShape.RECTANGLE, x: 470, y: 300, width: 220, height: 120, rotation: 0, capacity: 10, minCapacity: 6, isWindowSeat: false, isActive: true, notes: "Private dining room", imageUrl: PHOTO.private, floorId: r1Indoor.id },
  ]);

  const r1TerraceTables = await TableModel.bulkCreate([
    { label: "O1", shape: TableShape.CIRCLE,    x: 60,  y: 60,  width: 90,  height: 90, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Umbrella table", imageUrl: PHOTO.outdoor2, floorId: r1Terrace.id },
    { label: "O2", shape: TableShape.CIRCLE,    x: 200, y: 60,  width: 90,  height: 90, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Umbrella table", imageUrl: PHOTO.outdoor2, floorId: r1Terrace.id },
    { label: "O3", shape: TableShape.CIRCLE,    x: 340, y: 60,  width: 90,  height: 90, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Umbrella table", imageUrl: PHOTO.outdoor2, floorId: r1Terrace.id },
    { label: "O4", shape: TableShape.RECTANGLE, x: 60,  y: 230, width: 110, height: 75, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.outdoor4, floorId: r1Terrace.id },
    { label: "O5", shape: TableShape.RECTANGLE, x: 230, y: 230, width: 110, height: 75, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.outdoor4, floorId: r1Terrace.id },
    { label: "O6", shape: TableShape.RECTANGLE, x: 400, y: 230, width: 110, height: 75, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.outdoor4, floorId: r1Terrace.id },
    { label: "O7", shape: TableShape.RECTANGLE, x: 60,  y: 380, width: 160, height: 80, rotation: 0, capacity: 6, minCapacity: 3, isWindowSeat: false, isActive: true, imageUrl: PHOTO.outdoor6, floorId: r1Terrace.id },
    { label: "O8", shape: TableShape.RECTANGLE, x: 300, y: 380, width: 160, height: 80, rotation: 0, capacity: 6, minCapacity: 3, isWindowSeat: false, isActive: true, imageUrl: PHOTO.outdoor6, floorId: r1Terrace.id },
  ]);

  // ═══════════════════════════════════════════════════════
  // FLOORS & TABLES — R2 (Sakura Garden)
  // ═══════════════════════════════════════════════════════
  const r2Main = await Floor.create({ name: "Main Floor", sectionType: SectionType.INDOOR, width: 750, height: 550, bgColor: "#fdf8f0", restaurantId: r2.id });
  const r2Bar  = await Floor.create({ name: "Bar Lounge", sectionType: SectionType.BAR,    width: 600, height: 400, bgColor: "#0f0c0a", restaurantId: r2.id });

  await Wall.bulkCreate([
    { x1: 0,   y1: 0,   x2: 750, y2: 0,   floorId: r2Main.id },
    { x1: 750, y1: 0,   x2: 750, y2: 550, floorId: r2Main.id },
    { x1: 750, y1: 550, x2: 0,   y2: 550, floorId: r2Main.id },
    { x1: 0,   y1: 550, x2: 0,   y2: 0,   floorId: r2Main.id },
    { x1: 375, y1: 0,   x2: 375, y2: 180, floorId: r2Main.id },
  ]);
  await Wall.bulkCreate([
    { x1: 0,   y1: 0,   x2: 600, y2: 0,   floorId: r2Bar.id },
    { x1: 600, y1: 0,   x2: 600, y2: 400, floorId: r2Bar.id },
    { x1: 600, y1: 400, x2: 0,   y2: 400, floorId: r2Bar.id },
    { x1: 0,   y1: 400, x2: 0,   y2: 0,   floorId: r2Bar.id },
  ]);

  const r2MainTables = await TableModel.bulkCreate([
    { label: "S1", shape: TableShape.SQUARE,    x: 60,  y: 60,  width: 80, height: 80,  rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: true,  isActive: true, notes: "Zen garden view",    imageUrl: PHOTO.japanese, floorId: r2Main.id },
    { label: "S2", shape: TableShape.SQUARE,    x: 200, y: 60,  width: 80, height: 80,  rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: true,  isActive: true, notes: "Zen garden view",    imageUrl: PHOTO.japanese, floorId: r2Main.id },
    { label: "S3", shape: TableShape.SQUARE,    x: 340, y: 60,  width: 80, height: 80,  rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: true,  isActive: true, notes: "Zen garden view",    imageUrl: PHOTO.japanese, floorId: r2Main.id },
    { label: "S4", shape: TableShape.RECTANGLE, x: 60,  y: 220, width: 110, height: 75, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.sushi,    floorId: r2Main.id },
    { label: "S5", shape: TableShape.RECTANGLE, x: 230, y: 220, width: 110, height: 75, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.sushi,    floorId: r2Main.id },
    { label: "S6", shape: TableShape.RECTANGLE, x: 60,  y: 380, width: 140, height: 80, rotation: 0, capacity: 6, minCapacity: 4, isWindowSeat: false, isActive: true, notes: "Omakase counter",   imageUrl: PHOTO.japanese, floorId: r2Main.id },
    { label: "S7", shape: TableShape.RECTANGLE, x: 260, y: 380, width: 140, height: 80, rotation: 0, capacity: 6, minCapacity: 4, isWindowSeat: false, isActive: true, notes: "Omakase counter",   imageUrl: PHOTO.japanese, floorId: r2Main.id },
    { label: "P1", shape: TableShape.RECTANGLE, x: 430, y: 220, width: 200, height: 120, rotation: 0, capacity: 8, minCapacity: 4, isWindowSeat: false, isActive: true, notes: "Private tatami room", imageUrl: PHOTO.japanese, floorId: r2Main.id },
  ]);

  await TableModel.bulkCreate([
    { label: "B1", shape: TableShape.CIRCLE,    x: 80,  y: 80,  width: 75, height: 75, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Bar stool", imageUrl: PHOTO.bar, floorId: r2Bar.id },
    { label: "B2", shape: TableShape.CIRCLE,    x: 200, y: 80,  width: 75, height: 75, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Bar stool", imageUrl: PHOTO.bar, floorId: r2Bar.id },
    { label: "B3", shape: TableShape.CIRCLE,    x: 320, y: 80,  width: 75, height: 75, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Bar stool", imageUrl: PHOTO.bar, floorId: r2Bar.id },
    { label: "B4", shape: TableShape.RECTANGLE, x: 80,  y: 240, width: 120, height: 80, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.bar, floorId: r2Bar.id },
    { label: "B5", shape: TableShape.RECTANGLE, x: 280, y: 240, width: 120, height: 80, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.bar, floorId: r2Bar.id },
  ]);

  // ═══════════════════════════════════════════════════════
  // FLOORS & TABLES — R3 (Brasserie Lyon)
  // ═══════════════════════════════════════════════════════
  const r3Main = await Floor.create({ name: "Salle Principale", sectionType: SectionType.INDOOR, width: 850, height: 620, bgColor: "#fefbf5", restaurantId: r3.id });
  const r3Patio = await Floor.create({ name: "Patio",            sectionType: SectionType.OUTDOOR, width: 650, height: 450, bgColor: "#f0f7ec", restaurantId: r3.id });

  await Wall.bulkCreate([
    { x1: 0,   y1: 0,   x2: 850, y2: 0,   floorId: r3Main.id },
    { x1: 850, y1: 0,   x2: 850, y2: 620, floorId: r3Main.id },
    { x1: 850, y1: 620, x2: 0,   y2: 620, floorId: r3Main.id },
    { x1: 0,   y1: 620, x2: 0,   y2: 0,   floorId: r3Main.id },
    { x1: 0,   y1: 300, x2: 200, y2: 300, floorId: r3Main.id },
  ]);
  await Wall.bulkCreate([
    { x1: 0,   y1: 0,   x2: 650, y2: 0,   floorId: r3Patio.id },
    { x1: 650, y1: 0,   x2: 650, y2: 450, floorId: r3Patio.id },
    { x1: 650, y1: 450, x2: 0,   y2: 450, floorId: r3Patio.id },
    { x1: 0,   y1: 450, x2: 0,   y2: 0,   floorId: r3Patio.id },
  ]);

  const r3MainTables = await TableModel.bulkCreate([
    { label: "F1", shape: TableShape.RECTANGLE, x: 60,  y: 60,  width: 100, height: 70,  rotation: 0, capacity: 4, minCapacity: 1, isWindowSeat: true,  isActive: true, notes: "Street-facing window", imageUrl: PHOTO.french,   floorId: r3Main.id },
    { label: "F2", shape: TableShape.RECTANGLE, x: 220, y: 60,  width: 100, height: 70,  rotation: 0, capacity: 4, minCapacity: 1, isWindowSeat: true,  isActive: true, notes: "Street-facing window", imageUrl: PHOTO.french,   floorId: r3Main.id },
    { label: "F3", shape: TableShape.RECTANGLE, x: 380, y: 60,  width: 100, height: 70,  rotation: 0, capacity: 4, minCapacity: 1, isWindowSeat: false, isActive: true, imageUrl: PHOTO.french,   floorId: r3Main.id },
    { label: "F4", shape: TableShape.CIRCLE,    x: 60,  y: 220, width: 90,  height: 90,  rotation: 0, capacity: 3, minCapacity: 1, isWindowSeat: false, isActive: true, imageUrl: PHOTO.round,    floorId: r3Main.id },
    { label: "F5", shape: TableShape.CIRCLE,    x: 210, y: 220, width: 90,  height: 90,  rotation: 0, capacity: 3, minCapacity: 1, isWindowSeat: false, isActive: true, imageUrl: PHOTO.round,    floorId: r3Main.id },
    { label: "F6", shape: TableShape.CIRCLE,    x: 360, y: 220, width: 90,  height: 90,  rotation: 0, capacity: 3, minCapacity: 1, isWindowSeat: false, isActive: true, imageUrl: PHOTO.round,    floorId: r3Main.id },
    { label: "F7", shape: TableShape.RECTANGLE, x: 60,  y: 390, width: 130, height: 85,  rotation: 0, capacity: 6, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.long,     floorId: r3Main.id },
    { label: "F8", shape: TableShape.RECTANGLE, x: 250, y: 390, width: 130, height: 85,  rotation: 0, capacity: 6, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.long,     floorId: r3Main.id },
    { label: "F9", shape: TableShape.RECTANGLE, x: 520, y: 60,  width: 220, height: 140, rotation: 0, capacity: 10, minCapacity: 6, isWindowSeat: false, isActive: true, notes: "Banquet table",   imageUrl: PHOTO.private,  floorId: r3Main.id },
  ]);

  const r3PatioTables = await TableModel.bulkCreate([
    { label: "P1", shape: TableShape.CIRCLE,    x: 70,  y: 60,  width: 85, height: 85, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Heated terrace",  imageUrl: PHOTO.outdoor2, floorId: r3Patio.id },
    { label: "P2", shape: TableShape.CIRCLE,    x: 210, y: 60,  width: 85, height: 85, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Heated terrace",  imageUrl: PHOTO.outdoor2, floorId: r3Patio.id },
    { label: "P3", shape: TableShape.CIRCLE,    x: 350, y: 60,  width: 85, height: 85, rotation: 0, capacity: 2, minCapacity: 1, isWindowSeat: false, isActive: true, notes: "Heated terrace",  imageUrl: PHOTO.outdoor2, floorId: r3Patio.id },
    { label: "P4", shape: TableShape.RECTANGLE, x: 70,  y: 220, width: 110, height: 75, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.outdoor4, floorId: r3Patio.id },
    { label: "P5", shape: TableShape.RECTANGLE, x: 250, y: 220, width: 110, height: 75, rotation: 0, capacity: 4, minCapacity: 2, isWindowSeat: false, isActive: true, imageUrl: PHOTO.outdoor4, floorId: r3Patio.id },
    { label: "P6", shape: TableShape.RECTANGLE, x: 70,  y: 360, width: 150, height: 75, rotation: 0, capacity: 6, minCapacity: 3, isWindowSeat: false, isActive: true, imageUrl: PHOTO.outdoor6, floorId: r3Patio.id },
  ]);

  console.log("Floors and tables created.");

  // ═══════════════════════════════════════════════════════
  // RESERVATIONS
  // ═══════════════════════════════════════════════════════
  const today    = new Date().toISOString().split("T")[0];
  const tomorrow = daysAgo(-1);

  // Past completed reservations — unlock reviews for alice, bob, carol at each restaurant
  await Reservation.bulkCreate([
    // alice at r1
    { date: daysAgo(10), startTime: "19:00", partySize: 2, status: ReservationStatus.COMPLETED, notes: "Anniversary dinner", userId: alice.id, tableId: r1IndoorTables[0].id },
    // bob at r1
    { date: daysAgo(8),  startTime: "20:00", partySize: 4, status: ReservationStatus.COMPLETED, userId: bob.id,   tableId: r1IndoorTables[4].id },
    // carol at r1
    { date: daysAgo(5),  startTime: "13:00", partySize: 2, status: ReservationStatus.COMPLETED, userId: carol.id, tableId: r1TerraceTables[3].id },
    // alice at r2
    { date: daysAgo(14), startTime: "19:30", partySize: 2, status: ReservationStatus.COMPLETED, userId: alice.id, tableId: r2MainTables[0].id },
    // bob at r2
    { date: daysAgo(7),  startTime: "20:00", partySize: 4, status: ReservationStatus.COMPLETED, userId: bob.id,   tableId: r2MainTables[3].id },
    // carol at r2
    { date: daysAgo(3),  startTime: "12:30", partySize: 2, status: ReservationStatus.COMPLETED, userId: carol.id, tableId: r2MainTables[1].id },
    // alice at r3
    { date: daysAgo(20), startTime: "18:00", partySize: 3, status: ReservationStatus.COMPLETED, notes: "Business lunch", userId: alice.id, tableId: r3MainTables[6].id },
    // bob at r3
    { date: daysAgo(6),  startTime: "19:00", partySize: 2, status: ReservationStatus.COMPLETED, userId: bob.id,   tableId: r3PatioTables[0].id },
    // carol at r3
    { date: daysAgo(2),  startTime: "20:00", partySize: 4, status: ReservationStatus.COMPLETED, userId: carol.id, tableId: r3MainTables[2].id },
  ]);

  // Upcoming / active reservations
  await Reservation.bulkCreate([
    { date: today,    startTime: "12:00", partySize: 2, status: ReservationStatus.CONFIRMED, notes: "Lunch meeting",        userId: alice.id, tableId: r1IndoorTables[1].id },
    { date: today,    startTime: "19:00", partySize: 4, status: ReservationStatus.PENDING,   notes: "Birthday celebration", userId: bob.id,   tableId: r1IndoorTables[4].id },
    { date: today,    startTime: "20:00", partySize: 2, status: ReservationStatus.CONFIRMED, userId: alice.id, tableId: r1TerraceTables[0].id },
    { date: tomorrow, startTime: "13:00", partySize: 3, status: ReservationStatus.PENDING,   userId: bob.id,   tableId: r1IndoorTables[2].id },
    { date: tomorrow, startTime: "18:30", partySize: 8, status: ReservationStatus.CONFIRMED, notes: "Team dinner", userId: alice.id, tableId: r1IndoorTables[8].id },
    // r2 upcoming
    { date: today,    startTime: "19:00", partySize: 2, status: ReservationStatus.CONFIRMED, userId: carol.id, tableId: r2MainTables[0].id },
    { date: tomorrow, startTime: "20:00", partySize: 4, status: ReservationStatus.PENDING,   userId: alice.id, tableId: r2MainTables[3].id },
    // r3 upcoming
    { date: today,    startTime: "19:30", partySize: 2, status: ReservationStatus.CONFIRMED, userId: bob.id,   tableId: r3PatioTables[1].id },
    { date: tomorrow, startTime: "12:00", partySize: 6, status: ReservationStatus.PENDING,   userId: carol.id, tableId: r3MainTables[7].id },
    // guest reservation
    { date: today, startTime: "19:30", partySize: 2, status: ReservationStatus.PENDING, guestName: "Charlie Davis", guestEmail: "charlie@example.com", guestPhone: "+1-555-0303", userId: null, tableId: r1IndoorTables[0].id },
  ]);

  console.log("Reservations created.");

  // ═══════════════════════════════════════════════════════
  // REVIEWS
  // ═══════════════════════════════════════════════════════
  await Review.bulkCreate([
    // R1 — La Bella Vita
    { userId: alice.id, restaurantId: r1.id, stars: 5, text: "Absolutely stunning food. The pappardelle ai funghi porcini was the best pasta I've had outside Italy. Service was warm and attentive.", edited: false },
    { userId: bob.id,   restaurantId: r1.id, stars: 4, text: "Great atmosphere and solid Italian classics. The tiramisù was divine. Slightly long wait for mains on a busy Friday — hence 4 stars.", edited: true },
    { userId: carol.id, restaurantId: r1.id, stars: 5, text: "Magical evening on the terrace. The Barolo they recommended paired perfectly with the lamb. Will be back for sure.", edited: false },
    // R2 — Sakura Garden
    { userId: alice.id, restaurantId: r2.id, stars: 5, text: "The omakase counter is a must. Chef's choices were thoughtful and beautifully presented. Quieter than most sushi restaurants — perfect for conversation.", edited: false },
    { userId: bob.id,   restaurantId: r2.id, stars: 4, text: "Excellent quality fish and a wonderful sake selection. The tatami private room was a unique experience. Pricey but worth it for a special occasion.", edited: false },
    { userId: carol.id, restaurantId: r2.id, stars: 3, text: "Good food but the service felt rushed. The sashimi was fresh but portion sizes were smaller than expected for the price.", edited: false },
    // R3 — Brasserie Lyon
    { userId: alice.id, restaurantId: r3.id, stars: 4, text: "Classic brasserie done right. The steak frites was cooked to perfection and the frisée salad with lardons was a nice touch. Lively atmosphere.", edited: false },
    { userId: bob.id,   restaurantId: r3.id, stars: 5, text: "Best French onion soup in the city, full stop. The patio is gorgeous on a warm evening. Staff were knowledgeable about the wine list. Highly recommend.", edited: true },
    { userId: carol.id, restaurantId: r3.id, stars: 4, text: "Lovely spot for a long Sunday lunch. The crème brûlée was flawless. Would love to see more vegetarian options on the main menu.", edited: false },
  ]);

  console.log("Reviews created.");

  // ═══════════════════════════════════════════════════════
  // MENUS — R1 (La Bella Vita)
  // ═══════════════════════════════════════════════════════
  const r1Dinner = await Menu.create({ restaurantId: r1.id, name: "Dinner Menu", type: MenuType.STRUCTURED, layoutStyle: LayoutStyle.CARD_GRID, order: 0 });
  const [r1S, r1P, r1M, r1D] = await MenuGroup.bulkCreate([
    { menuId: r1Dinner.id, name: "Starters", order: 0 },
    { menuId: r1Dinner.id, name: "Pasta",    order: 1 },
    { menuId: r1Dinner.id, name: "Mains",    order: 2 },
    { menuId: r1Dinner.id, name: "Desserts", order: 3 },
  ]);
  await MenuItem.bulkCreate([
    { groupId: r1S.id, name: "Bruschetta al Pomodoro",      price: 9.50,  description: "Toasted bread with fresh tomatoes, basil and extra-virgin olive oil.", dietaryTags: ["vegan"],                        order: 0 },
    { groupId: r1S.id, name: "Burrata con Prosciutto",      price: 14.00, description: "Creamy burrata, San Daniele prosciutto, cherry tomatoes.",              dietaryTags: [],                               order: 1 },
    { groupId: r1S.id, name: "Zuppa di Funghi",             price: 11.00, description: "Wild mushroom soup with truffle oil and sourdough croutons.",           dietaryTags: ["vegetarian", "gluten-free"],    order: 2 },
    { groupId: r1S.id, name: "Calamari Fritti",             price: 13.50, description: "Crispy fried calamari with lemon aioli and marinara sauce.",            dietaryTags: [],                               order: 3 },
    { groupId: r1P.id, name: "Tagliatelle al Ragù",         price: 18.00, description: "Hand-rolled tagliatelle with slow-cooked Bolognese ragù.",             dietaryTags: [],                               order: 0 },
    { groupId: r1P.id, name: "Pappardelle ai Funghi Porcini", price: 19.50, description: "Wide pasta ribbons with porcini mushrooms, thyme and Parmigiano.",  dietaryTags: ["vegetarian"],                   order: 1 },
    { groupId: r1P.id, name: "Spaghetti alle Vongole",      price: 21.00, description: "Spaghetti with Manila clams, white wine, garlic and chilli.",          dietaryTags: ["dairy-free"],                   order: 2 },
    { groupId: r1P.id, name: "Risotto al Limone",           price: 17.50, description: "Carnaroli risotto with Amalfi lemon, Parmigiano and fresh herbs.",     dietaryTags: ["vegetarian", "gluten-free"],    order: 3 },
    { groupId: r1M.id, name: "Branzino al Forno",           price: 28.00, description: "Whole roasted sea bass with capers, olives and roasted potatoes.",     dietaryTags: ["gluten-free", "dairy-free"],    order: 0 },
    { groupId: r1M.id, name: "Costolette d'Agnello",        price: 32.00, description: "Rack of lamb with rosemary jus, grilled vegetables and polenta.",      dietaryTags: ["gluten-free"],                  order: 1 },
    { groupId: r1M.id, name: "Pollo alla Milanese",         price: 24.00, description: "Breaded chicken breast with rocket, cherry tomatoes and lemon.",       dietaryTags: [],                               order: 2 },
    { groupId: r1M.id, name: "Melanzane alla Parmigiana",   price: 19.00, description: "Baked aubergine with San Marzano tomato, mozzarella and basil.",       dietaryTags: ["vegetarian", "gluten-free"],    order: 3 },
    { groupId: r1D.id, name: "Tiramisù Classico",           price: 9.00,  description: "House-made tiramisù with mascarpone and savoiardi biscuits.",          dietaryTags: [],                               order: 0 },
    { groupId: r1D.id, name: "Panna Cotta alla Vaniglia",   price: 8.50,  description: "Set vanilla cream with seasonal berry compote.",                       dietaryTags: ["vegetarian", "gluten-free"],    order: 1 },
    { groupId: r1D.id, name: "Tortino al Cioccolato",       price: 10.00, description: "Warm dark chocolate fondant with pistachio gelato.",                   dietaryTags: ["vegetarian", "nuts"],           order: 2 },
    { groupId: r1D.id, name: "Sorbetto al Limone",          price: 7.50,  description: "Amalfi lemon sorbet served in the shell.",                             dietaryTags: ["vegan", "gluten-free", "dairy-free"], order: 3 },
  ]);

  const r1Drinks = await Menu.create({ restaurantId: r1.id, name: "Drinks Menu", type: MenuType.STRUCTURED, layoutStyle: LayoutStyle.TWO_COLUMN, order: 1 });
  const [r1Wine, r1Cock, r1Soft] = await MenuGroup.bulkCreate([
    { menuId: r1Drinks.id, name: "Wine",        order: 0 },
    { menuId: r1Drinks.id, name: "Cocktails",   order: 1 },
    { menuId: r1Drinks.id, name: "Soft Drinks", order: 2 },
  ]);
  await MenuItem.bulkCreate([
    { groupId: r1Wine.id, name: "Barolo DOCG — Piedmont",     price: 14.00, description: "Full-bodied red, notes of cherry and leather. Glass.", dietaryTags: ["vegan"], order: 0 },
    { groupId: r1Wine.id, name: "Chianti Classico Riserva",   price: 12.00, description: "Tuscan red, medium body, dried fruit finish. Glass.",  dietaryTags: ["vegan"], order: 1 },
    { groupId: r1Wine.id, name: "Pinot Grigio delle Venezie", price: 10.00, description: "Crisp white, citrus and pear. Glass.",                 dietaryTags: ["vegan"], order: 2 },
    { groupId: r1Wine.id, name: "Prosecco DOC Extra Dry",     price: 9.50,  description: "Fine bubbles, apple blossom, delicate sweetness. Glass.", dietaryTags: ["vegan"], order: 3 },
    { groupId: r1Cock.id, name: "Aperol Spritz",              price: 11.00, description: "Aperol, Prosecco, soda, fresh orange slice.",         dietaryTags: [], order: 0 },
    { groupId: r1Cock.id, name: "Negroni",                    price: 13.00, description: "Gin, Campari, sweet vermouth, orange peel.",          dietaryTags: [], order: 1 },
    { groupId: r1Cock.id, name: "Hugo",                       price: 10.00, description: "Elderflower cordial, Prosecco, fresh mint, lime.",    dietaryTags: [], order: 2 },
    { groupId: r1Cock.id, name: "Limoncello Sour",            price: 12.00, description: "Limoncello, lemon juice, egg white, Angostura bitters.", dietaryTags: [], order: 3 },
    { groupId: r1Soft.id, name: "San Pellegrino",             price: 4.00,  description: "Sparkling mineral water 750ml.",                     dietaryTags: ["vegan"], order: 0 },
    { groupId: r1Soft.id, name: "Acqua Panna",                price: 4.00,  description: "Still mineral water 750ml.",                         dietaryTags: ["vegan"], order: 1 },
    { groupId: r1Soft.id, name: "Limonata Artigianale",       price: 5.50,  description: "House-made lemonade with fresh mint.",               dietaryTags: ["vegan", "gluten-free"], order: 2 },
    { groupId: r1Soft.id, name: "Caffè Espresso",             price: 3.50,  description: "Single or double shot Italian espresso.",            dietaryTags: ["vegan", "gluten-free", "dairy-free"], order: 3 },
  ]);

  // ═══════════════════════════════════════════════════════
  // MENUS — R2 (Sakura Garden)
  // ═══════════════════════════════════════════════════════
  const r2Menu = await Menu.create({ restaurantId: r2.id, name: "Omakase Menu", type: MenuType.STRUCTURED, layoutStyle: LayoutStyle.CARD_GRID, order: 0 });
  const [r2Cold, r2Warm, r2Sushi, r2Dessert] = await MenuGroup.bulkCreate([
    { menuId: r2Menu.id, name: "Cold Starters",  order: 0 },
    { menuId: r2Menu.id, name: "Warm Dishes",    order: 1 },
    { menuId: r2Menu.id, name: "Sushi & Sashimi", order: 2 },
    { menuId: r2Menu.id, name: "Desserts",       order: 3 },
  ]);
  await MenuItem.bulkCreate([
    { groupId: r2Cold.id, name: "Edamame",                     price: 6.00,  description: "Steamed salted edamame pods.",                                  dietaryTags: ["vegan", "gluten-free"],         order: 0 },
    { groupId: r2Cold.id, name: "Sunomono",                    price: 9.50,  description: "Cucumber and wakame salad with rice vinegar dressing.",         dietaryTags: ["vegan", "gluten-free"],         order: 1 },
    { groupId: r2Cold.id, name: "Agedashi Tofu",               price: 11.00, description: "Crispy fried tofu in dashi broth with grated daikon.",          dietaryTags: ["vegetarian"],                   order: 2 },
    { groupId: r2Cold.id, name: "Salmon Tataki",               price: 16.00, description: "Seared salmon with ponzu, microgreens and sesame oil.",         dietaryTags: ["gluten-free", "dairy-free"],    order: 3 },
    { groupId: r2Warm.id, name: "Miso Soup",                   price: 5.00,  description: "White miso broth with silken tofu, wakame and spring onion.",   dietaryTags: ["vegan", "gluten-free"],         order: 0 },
    { groupId: r2Warm.id, name: "Gyoza",                       price: 12.00, description: "Pan-fried pork and cabbage dumplings with ponzu dipping sauce.", dietaryTags: ["dairy-free"],                  order: 1 },
    { groupId: r2Warm.id, name: "Black Cod Miso",              price: 32.00, description: "Nobu-style black cod marinated in sweet miso, served with bok choy.", dietaryTags: ["gluten-free", "dairy-free"], order: 2 },
    { groupId: r2Warm.id, name: "Wagyu Beef Teriyaki",         price: 38.00, description: "A5 Wagyu striploin with house teriyaki glaze and pickled ginger.", dietaryTags: ["gluten-free", "dairy-free"], order: 3 },
    { groupId: r2Sushi.id, name: "Nigiri Selection (6pc)",     price: 22.00, description: "Chef's choice of six seasonal nigiri.",                          dietaryTags: ["gluten-free", "dairy-free"],    order: 0 },
    { groupId: r2Sushi.id, name: "Sashimi Platter (12pc)",     price: 34.00, description: "Twelve slices of tuna, salmon, yellowtail and scallop.",        dietaryTags: ["gluten-free", "dairy-free"],    order: 1 },
    { groupId: r2Sushi.id, name: "Dragon Roll",                price: 19.00, description: "Shrimp tempura inside, avocado and eel on top.",                 dietaryTags: ["dairy-free"],                  order: 2 },
    { groupId: r2Sushi.id, name: "Spicy Tuna Roll",            price: 16.00, description: "Diced tuna with sriracha mayo, cucumber and tobiko.",            dietaryTags: ["dairy-free", "spicy"],          order: 3 },
    { groupId: r2Dessert.id, name: "Matcha Panna Cotta",       price: 9.00,  description: "Ceremonial matcha panna cotta with azuki bean compote.",         dietaryTags: ["vegetarian", "gluten-free"],    order: 0 },
    { groupId: r2Dessert.id, name: "Mochi Ice Cream (3pc)",    price: 10.00, description: "House-made mochi — matcha, yuzu, and black sesame.",             dietaryTags: ["vegetarian"],                   order: 1 },
  ]);

  const r2Drinks = await Menu.create({ restaurantId: r2.id, name: "Drinks", type: MenuType.STRUCTURED, layoutStyle: LayoutStyle.TWO_COLUMN, order: 1 });
  const [r2Sake, r2Sig] = await MenuGroup.bulkCreate([
    { menuId: r2Drinks.id, name: "Sake & Wine",       order: 0 },
    { menuId: r2Drinks.id, name: "Signature Drinks",  order: 1 },
  ]);
  await MenuItem.bulkCreate([
    { groupId: r2Sake.id, name: "Dassai 45 Junmai Daiginjo", price: 16.00, description: "Smooth and fruity sake, premium grade. 180ml carafe.", dietaryTags: ["vegan", "gluten-free"], order: 0 },
    { groupId: r2Sake.id, name: "Hakutsuru Nigori",           price: 12.00, description: "Cloudy unfiltered sake, creamy with a hint of sweetness. 180ml.", dietaryTags: ["vegan"], order: 1 },
    { groupId: r2Sake.id, name: "Plum Wine",                  price: 9.00,  description: "Japanese ume plum wine, sweet and fragrant. Glass.",  dietaryTags: ["vegan"], order: 2 },
    { groupId: r2Sig.id,  name: "Yuzu Margarita",             price: 14.00, description: "Yuzu juice, tequila, triple sec, salted rim.",         dietaryTags: [], order: 0 },
    { groupId: r2Sig.id,  name: "Matcha Latte",               price: 7.00,  description: "Ceremonial matcha whisked with oat milk.",             dietaryTags: ["vegan", "dairy-free", "gluten-free"], order: 1 },
    { groupId: r2Sig.id,  name: "Ginger Highball",            price: 11.00, description: "Japanese whisky, ginger beer, fresh lime.",            dietaryTags: [], order: 2 },
  ]);

  // ═══════════════════════════════════════════════════════
  // MENUS — R3 (Brasserie Lyon)
  // ═══════════════════════════════════════════════════════
  const r3Menu = await Menu.create({ restaurantId: r3.id, name: "Brasserie Menu", type: MenuType.STRUCTURED, layoutStyle: LayoutStyle.CARD_GRID, order: 0 });
  const [r3En, r3Pl, r3Fr] = await MenuGroup.bulkCreate([
    { menuId: r3Menu.id, name: "Entrées",  order: 0 },
    { menuId: r3Menu.id, name: "Plats",    order: 1 },
    { menuId: r3Menu.id, name: "Fromages & Desserts", order: 2 },
  ]);
  await MenuItem.bulkCreate([
    { groupId: r3En.id, name: "Soupe à l'Oignon Gratinée",   price: 12.00, description: "Classic French onion soup with Gruyère croûton.",              dietaryTags: ["vegetarian"],                   order: 0 },
    { groupId: r3En.id, name: "Salade Frisée aux Lardons",   price: 13.50, description: "Frisée lettuce, crispy smoked lardons, poached egg, Dijon dressing.", dietaryTags: [],                         order: 1 },
    { groupId: r3En.id, name: "Huîtres de Bretagne (6pc)",   price: 22.00, description: "Fresh Brittany oysters with shallot vinegar and rye bread.",    dietaryTags: ["gluten-free", "dairy-free"],    order: 2 },
    { groupId: r3En.id, name: "Terrine de Campagne",          price: 14.00, description: "Rustic pork and herb terrine with cornichons and sourdough.",   dietaryTags: [],                               order: 3 },
    { groupId: r3Pl.id, name: "Steak Frites",                 price: 29.00, description: "Entrecôte cooked à point, hand-cut frites and béarnaise sauce.", dietaryTags: ["gluten-free"],                order: 0 },
    { groupId: r3Pl.id, name: "Moules Marinières",            price: 24.00, description: "Steamed mussels in white wine, garlic and shallots with frites.", dietaryTags: ["dairy-free"],                order: 1 },
    { groupId: r3Pl.id, name: "Poulet Rôti Fermier",          price: 26.00, description: "Whole roasted free-range chicken leg with dauphinois potatoes.", dietaryTags: ["gluten-free"],                order: 2 },
    { groupId: r3Pl.id, name: "Tarte Flambée",                price: 18.00, description: "Alsatian flatbread with crème fraîche, caramelised onions and lardons.", dietaryTags: ["vegetarian"],          order: 3 },
    { groupId: r3Fr.id, name: "Plateau de Fromages",          price: 16.00, description: "Selection of three French cheeses with fig jam and walnuts.",   dietaryTags: ["vegetarian", "nuts"],           order: 0 },
    { groupId: r3Fr.id, name: "Crème Brûlée",                 price: 9.00,  description: "Classic vanilla crème brûlée with caramelised sugar crust.",    dietaryTags: ["vegetarian", "gluten-free"],    order: 1 },
    { groupId: r3Fr.id, name: "Tarte Tatin",                  price: 10.00, description: "Warm caramelised apple tart with crème fraîche.",               dietaryTags: ["vegetarian"],                   order: 2 },
    { groupId: r3Fr.id, name: "Profiteroles au Chocolat",     price: 10.50, description: "Choux pastry filled with vanilla ice cream, warm chocolate sauce.", dietaryTags: ["vegetarian"],               order: 3 },
  ]);

  const r3Drinks = await Menu.create({ restaurantId: r3.id, name: "Carte des Vins", type: MenuType.STRUCTURED, layoutStyle: LayoutStyle.TWO_COLUMN, order: 1 });
  const [r3Rouge, r3Blanc, r3Coc] = await MenuGroup.bulkCreate([
    { menuId: r3Drinks.id, name: "Vins Rouges",  order: 0 },
    { menuId: r3Drinks.id, name: "Vins Blancs",  order: 1 },
    { menuId: r3Drinks.id, name: "Cocktails",    order: 2 },
  ]);
  await MenuItem.bulkCreate([
    { groupId: r3Rouge.id, name: "Côtes du Rhône Villages",  price: 11.00, description: "Grenache-Syrah blend, smoky notes, long finish. Glass.",   dietaryTags: ["vegan"], order: 0 },
    { groupId: r3Rouge.id, name: "Saint-Émilion Grand Cru",  price: 18.00, description: "Merlot-dominant Bordeaux, plum and cedar. Glass.",         dietaryTags: ["vegan"], order: 1 },
    { groupId: r3Rouge.id, name: "Beaujolais Villages",       price: 10.00, description: "Light-bodied Gamay, fresh cherry, easy-drinking. Glass.",  dietaryTags: ["vegan"], order: 2 },
    { groupId: r3Blanc.id, name: "Muscadet Sèvre et Maine",  price: 10.00, description: "Crisp and mineral, perfect with seafood. Glass.",          dietaryTags: ["vegan"], order: 0 },
    { groupId: r3Blanc.id, name: "Chablis Premier Cru",       price: 15.00, description: "Elegant and flinty Chardonnay. Glass.",                    dietaryTags: ["vegan"], order: 1 },
    { groupId: r3Blanc.id, name: "Champagne Brut",            price: 17.00, description: "House champagne, fine mousse, toasted brioche notes. Glass.", dietaryTags: ["vegan"], order: 2 },
    { groupId: r3Coc.id,  name: "Kir Royal",                  price: 12.00, description: "Crème de cassis and Champagne.",                          dietaryTags: [], order: 0 },
    { groupId: r3Coc.id,  name: "French 75",                   price: 13.00, description: "Gin, lemon juice, sugar, Champagne.",                    dietaryTags: [], order: 1 },
    { groupId: r3Coc.id,  name: "Pastis Mauresque",            price: 10.00, description: "Pastis with orgeat syrup and chilled water.",             dietaryTags: ["vegan"], order: 2 },
  ]);

  console.log("Menus created.");

  // ═══════════════════════════════════════════════════════
  // FEATURE FLAGS
  // ═══════════════════════════════════════════════════════
  const featureDefs = [
    { key: "floor_editor",              name: "Floor Plan Editor",      description: "Visual drag-and-drop editor to design restaurant layouts with tables and walls." },
    { key: "multi_floor",               name: "Multiple Floors",        description: "Add more than one floor or section (indoor, outdoor, bar, private) per restaurant." },
    { key: "staff_management",          name: "Staff Management",       description: "Invite staff members, assign roles (Manager, Host, Waiter, Chef) and fine-grained permissions." },
    { key: "custom_smtp",               name: "Custom Email (SMTP)",    description: "Send reservation confirmations and notifications from your own domain via custom SMTP." },
    { key: "events",                    name: "Events",                 description: "Create and promote special events such as tasting dinners, live music nights, or holiday menus." },
    { key: "waitlist",                  name: "Waitlist",               description: "Let guests join a digital waitlist when the restaurant is fully booked and notify them automatically." },
    { key: "menu_management",           name: "Menu Builder",           description: "Build structured menus with groups and items, or upload photo menus. Display publicly on your page." },
    { key: "reviews",                   name: "Reviews",                description: "Collect verified post-visit reviews from diners and display star ratings on your restaurant page." },
    { key: "reports",                   name: "Reports & Analytics",    description: "Reservation reports, occupancy trends, cancellation rates, and party-size breakdowns." },
    { key: "guest_notes",               name: "Guest CRM",              description: "Add private notes to guest profiles — dietary preferences, allergies, VIP status, visit history." },
    { key: "custom_reservation_times",  name: "Custom Time Slots",      description: "Define your own reservation time windows instead of using default 30-minute intervals." },
  ];

  const features = await Feature.bulkCreate(
    featureDefs.map((f) => ({ ...f, isActive: true }))
  );

  // Helper: find feature by key
  const feat = (key: string) => features.find((f) => f.key === key)!;

  console.log("Features created.");

  // ═══════════════════════════════════════════════════════
  // PLANS
  // ═══════════════════════════════════════════════════════

  const planFreeTrial = await Plan.create({
    slug: "free_trial",
    name: "Free Trial",
    description: "Try Mesa free for 90 days. Core reservations, floor editor, and menu builder included.",
    priceMonthly: 0,
    trialDays: 90,
    isActive: true,
    sortOrder: 0,
  });

  const planPro = await Plan.create({
    slug: "pro",
    name: "Pro",
    description: "Everything you need to run a professional restaurant. Staff roles, events, waitlist, custom email, and analytics.",
    priceMonthly: 4900,   // $49 / mo
    trialDays: null,
    isActive: true,
    sortOrder: 1,
  });

  const planPremium = await Plan.create({
    slug: "premium",
    name: "Premium",
    description: "Full platform access. All Pro features plus Guest CRM and priority support.",
    priceMonthly: 9900,   // $99 / mo
    trialDays: null,
    isActive: true,
    sortOrder: 2,
  });

  console.log("Plans created.");

  // ═══════════════════════════════════════════════════════
  // PLAN → FEATURES
  // ═══════════════════════════════════════════════════════

  const freeTrialFeatureKeys = [
    "floor_editor",
    "menu_management",
    "reviews",
    "custom_reservation_times",
  ];

  const proFeatureKeys = [
    "floor_editor",
    "multi_floor",
    "staff_management",
    "custom_smtp",
    "events",
    "waitlist",
    "menu_management",
    "reviews",
    "reports",
    "custom_reservation_times",
  ];

  const premiumFeatureKeys = [
    // All features
    "floor_editor",
    "multi_floor",
    "staff_management",
    "custom_smtp",
    "events",
    "waitlist",
    "menu_management",
    "reviews",
    "reports",
    "guest_notes",
    "custom_reservation_times",
  ];

  await PlanFeature.bulkCreate(
    freeTrialFeatureKeys.map((key) => ({ planId: planFreeTrial.id, featureId: feat(key).id }))
  );
  await PlanFeature.bulkCreate(
    proFeatureKeys.map((key) => ({ planId: planPro.id, featureId: feat(key).id }))
  );
  await PlanFeature.bulkCreate(
    premiumFeatureKeys.map((key) => ({ planId: planPremium.id, featureId: feat(key).id }))
  );

  console.log("Plan features linked.");

  // ═══════════════════════════════════════════════════════
  // SUBSCRIPTIONS  (one per demo restaurant)
  // ═══════════════════════════════════════════════════════

  const now = new Date();
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);

  // La Bella Vita → Premium (active, renewed monthly)
  await Subscription.create({
    restaurantId: r1.id,
    planId: planPremium.id,
    status: SubscriptionStatus.ACTIVE,
    trialEndsAt: null,
    currentPeriodEnd: daysFromNow(30),
  });

  // Sakura Garden → Pro (active)
  await Subscription.create({
    restaurantId: r2.id,
    planId: planPro.id,
    status: SubscriptionStatus.ACTIVE,
    trialEndsAt: null,
    currentPeriodEnd: daysFromNow(30),
  });

  // Brasserie Lyon → Free Trial (trialing, 90-day window)
  await Subscription.create({
    restaurantId: r3.id,
    planId: planFreeTrial.id,
    status: SubscriptionStatus.TRIALING,
    trialEndsAt: daysFromNow(90),
    currentPeriodEnd: null,
  });

  console.log("Subscriptions created.");

  console.log("\n✓ Seed complete.");
  console.log("  owner@example.com   / password123  (RESTAURANT_OWNER — La Bella Vita)");
  console.log("  owner2@example.com  / password123  (RESTAURANT_OWNER — Sakura Garden)");
  console.log("  owner3@example.com  / password123  (RESTAURANT_OWNER — Brasserie Lyon)");
  console.log("  alice@example.com   / password123  (USER — reviewed all 3 restaurants)");
  console.log("  bob@example.com     / password123  (USER — reviewed all 3 restaurants)");
  console.log("  carol@example.com   / password123  (USER — reviewed all 3 restaurants)");
  console.log("  manager@example.com / password123  (MANAGER at La Bella Vita)");
  console.log("  host@example.com    / password123  (HOST at La Bella Vita)");
  console.log("  waiter@example.com  / password123  (WAITER at La Bella Vita)");
  console.log("  admin@mesa.com      / AdminMes@    (ADMIN — platform admin)");
  console.log("\nPlans:");
  console.log("  free_trial  — Free,  90-day trial  — floor_editor, menu_management, reviews, custom_reservation_times");
  console.log("  pro         — $49/mo               — + multi_floor, staff_management, custom_smtp, events, waitlist, reports");
  console.log("  premium     — $99/mo               — all features including guest_notes");
  console.log("\nSubscriptions:");
  console.log("  La Bella Vita  → Premium  (ACTIVE)");
  console.log("  Sakura Garden  → Pro      (ACTIVE)");
  console.log("  Brasserie Lyon → FreeTrial (TRIALING, 90 days)");

  await sequelize.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
