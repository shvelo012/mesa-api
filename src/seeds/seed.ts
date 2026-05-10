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

async function seed() {
  await connectDB();

  // wipe in dependency order
  await Reservation.destroy({ where: {} });
  await Wall.destroy({ where: {} });
  await TableModel.destroy({ where: {} });
  await Floor.destroy({ where: {} });
  await Restaurant.destroy({ where: {} });
  await User.destroy({ where: {} });

  console.log("Cleared existing data.");

  // ── users ──────────────────────────────────────────────
  const ownerPassword = await bcrypt.hash("password123", 12);
  const userPassword = await bcrypt.hash("password123", 12);

  const owner = await User.create({
    email: "owner@example.com",
    password: ownerPassword,
    name: "Marco Rossi",
    phone: "+1-555-0100",
    role: Role.RESTAURANT_OWNER,
  });

  const user1 = await User.create({
    email: "alice@example.com",
    password: userPassword,
    name: "Alice Johnson",
    phone: "+1-555-0201",
    role: Role.USER,
  });

  const user2 = await User.create({
    email: "bob@example.com",
    password: userPassword,
    name: "Bob Smith",
    phone: "+1-555-0202",
    role: Role.USER,
  });

  console.log("Users created.");

  // ── restaurant ─────────────────────────────────────────
  const restaurant = await Restaurant.create({
    name: "La Bella Vita",
    slug: "la-bella-vita",
    description: "Authentic Italian cuisine in the heart of the city.",
    address: "123 Via Roma, Downtown",
    phone: "+1-555-0199",
    email: "info@labellavita.com",
    cuisine: "Italian",
    openTime: "11:00",
    closeTime: "23:00",
    ownerId: owner.id,
  });

  console.log("Restaurant created.");

  // ── floors ─────────────────────────────────────────────
  const indoorFloor = await Floor.create({
    name: "Main Hall",
    sectionType: SectionType.INDOOR,
    width: 800,
    height: 600,
    bgColor: "#faf7f2",
    restaurantId: restaurant.id,
  });

  const outdoorFloor = await Floor.create({
    name: "Terrace",
    sectionType: SectionType.OUTDOOR,
    width: 700,
    height: 500,
    bgColor: "#ecfdf5",
    restaurantId: restaurant.id,
  });

  console.log("Floors created.");

  // ── indoor walls ───────────────────────────────────────
  await Wall.bulkCreate([
    { x1: 0,   y1: 0,   x2: 800, y2: 0,   floorId: indoorFloor.id },
    { x1: 800, y1: 0,   x2: 800, y2: 600, floorId: indoorFloor.id },
    { x1: 800, y1: 600, x2: 0,   y2: 600, floorId: indoorFloor.id },
    { x1: 0,   y1: 600, x2: 0,   y2: 0,   floorId: indoorFloor.id },
    // divider wall
    { x1: 400, y1: 0,   x2: 400, y2: 200, floorId: indoorFloor.id },
  ]);

  // ── table photos (Unsplash) ────────────────────────────
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
  };

  // ── indoor tables ──────────────────────────────────────
  const indoorTables = await TableModel.bulkCreate([
    {
      label: "T1", shape: TableShape.RECTANGLE,
      x: 50,  y: 60,  width: 100, height: 70,
      rotation: 0, capacity: 4, minCapacity: 1,
      isWindowSeat: true, isActive: true,
      notes: "Overlooks the street",
      imageUrl: PHOTO.window4,
      floorId: indoorFloor.id,
    },
    {
      label: "T2", shape: TableShape.RECTANGLE,
      x: 200, y: 60,  width: 100, height: 70,
      rotation: 0, capacity: 4, minCapacity: 1,
      isWindowSeat: true, isActive: true,
      imageUrl: PHOTO.window4,
      floorId: indoorFloor.id,
    },
    {
      label: "T3", shape: TableShape.CIRCLE,
      x: 50,  y: 220, width: 90,  height: 90,
      rotation: 0, capacity: 3, minCapacity: 1,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.round,
      floorId: indoorFloor.id,
    },
    {
      label: "T4", shape: TableShape.CIRCLE,
      x: 200, y: 220, width: 90,  height: 90,
      rotation: 0, capacity: 3, minCapacity: 1,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.round,
      floorId: indoorFloor.id,
    },
    {
      label: "T5", shape: TableShape.RECTANGLE,
      x: 50,  y: 380, width: 120, height: 80,
      rotation: 0, capacity: 6, minCapacity: 2,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.long,
      floorId: indoorFloor.id,
    },
    {
      label: "T6", shape: TableShape.RECTANGLE,
      x: 220, y: 380, width: 120, height: 80,
      rotation: 0, capacity: 6, minCapacity: 2,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.long,
      floorId: indoorFloor.id,
    },
    // right side (bar area)
    {
      label: "B1", shape: TableShape.SQUARE,
      x: 470, y: 60,  width: 70,  height: 70,
      rotation: 0, capacity: 2, minCapacity: 1,
      isWindowSeat: false, isActive: true,
      notes: "Bar counter seat",
      imageUrl: PHOTO.bar,
      floorId: indoorFloor.id,
    },
    {
      label: "B2", shape: TableShape.SQUARE,
      x: 580, y: 60,  width: 70,  height: 70,
      rotation: 0, capacity: 2, minCapacity: 1,
      isWindowSeat: false, isActive: true,
      notes: "Bar counter seat",
      imageUrl: PHOTO.bar,
      floorId: indoorFloor.id,
    },
    {
      label: "P1", shape: TableShape.RECTANGLE,
      x: 470, y: 300, width: 220, height: 120,
      rotation: 0, capacity: 10, minCapacity: 6,
      isWindowSeat: false, isActive: true,
      notes: "Private dining room — large group",
      imageUrl: PHOTO.private,
      floorId: indoorFloor.id,
    },
  ]);

  // ── outdoor walls ──────────────────────────────────────
  await Wall.bulkCreate([
    { x1: 0,   y1: 0,   x2: 700, y2: 0,   floorId: outdoorFloor.id },
    { x1: 700, y1: 0,   x2: 700, y2: 500, floorId: outdoorFloor.id },
    { x1: 700, y1: 500, x2: 0,   y2: 500, floorId: outdoorFloor.id },
    { x1: 0,   y1: 500, x2: 0,   y2: 0,   floorId: outdoorFloor.id },
  ]);

  // ── outdoor tables ─────────────────────────────────────
  const outdoorTables = await TableModel.bulkCreate([
    {
      label: "O1", shape: TableShape.CIRCLE,
      x: 60,  y: 60,  width: 90, height: 90,
      rotation: 0, capacity: 2, minCapacity: 1,
      isWindowSeat: false, isActive: true,
      notes: "Umbrella table",
      imageUrl: PHOTO.outdoor2,
      floorId: outdoorFloor.id,
    },
    {
      label: "O2", shape: TableShape.CIRCLE,
      x: 200, y: 60,  width: 90, height: 90,
      rotation: 0, capacity: 2, minCapacity: 1,
      isWindowSeat: false, isActive: true,
      notes: "Umbrella table",
      imageUrl: PHOTO.outdoor2,
      floorId: outdoorFloor.id,
    },
    {
      label: "O3", shape: TableShape.CIRCLE,
      x: 340, y: 60,  width: 90, height: 90,
      rotation: 0, capacity: 2, minCapacity: 1,
      isWindowSeat: false, isActive: true,
      notes: "Umbrella table",
      imageUrl: PHOTO.outdoor2,
      floorId: outdoorFloor.id,
    },
    {
      label: "O4", shape: TableShape.RECTANGLE,
      x: 60,  y: 230, width: 110, height: 75,
      rotation: 0, capacity: 4, minCapacity: 2,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.outdoor4,
      floorId: outdoorFloor.id,
    },
    {
      label: "O5", shape: TableShape.RECTANGLE,
      x: 230, y: 230, width: 110, height: 75,
      rotation: 0, capacity: 4, minCapacity: 2,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.outdoor4,
      floorId: outdoorFloor.id,
    },
    {
      label: "O6", shape: TableShape.RECTANGLE,
      x: 400, y: 230, width: 110, height: 75,
      rotation: 0, capacity: 4, minCapacity: 2,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.outdoor4,
      floorId: outdoorFloor.id,
    },
    {
      label: "O7", shape: TableShape.RECTANGLE,
      x: 60,  y: 380, width: 160, height: 80,
      rotation: 0, capacity: 6, minCapacity: 3,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.outdoor6,
      floorId: outdoorFloor.id,
    },
    {
      label: "O8", shape: TableShape.RECTANGLE,
      x: 300, y: 380, width: 160, height: 80,
      rotation: 0, capacity: 6, minCapacity: 3,
      isWindowSeat: false, isActive: true,
      imageUrl: PHOTO.outdoor6,
      floorId: outdoorFloor.id,
    },
  ]);

  console.log("Tables and walls created.");

  // ── reservations ───────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  await Reservation.bulkCreate([
    {
      date: today,
      startTime: "12:00",
      endTime: "13:30",
      partySize: 2,
      status: ReservationStatus.CONFIRMED,
      notes: "Anniversary dinner",
      userId: user1.id,
      tableId: indoorTables[0].id,
    },
    {
      date: today,
      startTime: "19:00",
      endTime: "21:00",
      partySize: 4,
      status: ReservationStatus.PENDING,
      notes: "Birthday — please bring dessert menu",
      userId: user2.id,
      tableId: indoorTables[4].id,
    },
    {
      date: today,
      startTime: "20:00",
      endTime: "22:00",
      partySize: 2,
      status: ReservationStatus.CONFIRMED,
      userId: user1.id,
      tableId: outdoorTables[0].id,
    },
    {
      date: tomorrow,
      startTime: "13:00",
      endTime: "14:30",
      partySize: 3,
      status: ReservationStatus.PENDING,
      userId: user2.id,
      tableId: indoorTables[2].id,
    },
    {
      date: tomorrow,
      startTime: "18:30",
      endTime: "20:30",
      partySize: 8,
      status: ReservationStatus.CONFIRMED,
      notes: "Business dinner",
      userId: user1.id,
      tableId: indoorTables[8].id,
    },
  ]);

  console.log("Reservations created.");
  console.log("\n✓ Seed complete.");
  console.log("  owner@example.com  / password123  (RESTAURANT_OWNER)");
  console.log("  alice@example.com  / password123  (USER)");
  console.log("  bob@example.com    / password123  (USER)");

  await sequelize.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
