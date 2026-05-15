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

async function seed() {
  await connectDB();

  // wipe in dependency order
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
    // ── overlapping pending reservations for testing ──
    {
      date: today,
      startTime: "18:00",
      endTime: "20:00",
      partySize: 2,
      status: ReservationStatus.PENDING,
      notes: "Date night",
      userId: user1.id,
      tableId: indoorTables[0].id,
    },
    {
      date: today,
      startTime: "19:00",
      endTime: "21:00",
      partySize: 3,
      status: ReservationStatus.PENDING,
      notes: "Friends reunion",
      userId: user2.id,
      tableId: indoorTables[0].id,
    },
    {
      date: today,
      startTime: "19:30",
      endTime: "21:30",
      partySize: 2,
      status: ReservationStatus.PENDING,
      notes: "Walk-in request",
      guestName: "Charlie Davis",
      guestEmail: "charlie@example.com",
      guestPhone: "+1-555-0303",
      userId: null,
      tableId: indoorTables[0].id,
    },
  ]);

  console.log("Reservations created.");

  // ── menus ──────────────────────────────────────────────
  const dinnerMenu = await Menu.create({
    restaurantId: restaurant.id,
    name: "Dinner Menu",
    type: MenuType.STRUCTURED,
    layoutStyle: LayoutStyle.CARD_GRID,
    order: 0,
  });

  const [starters, pasta, mains, desserts] = await MenuGroup.bulkCreate([
    { menuId: dinnerMenu.id, name: "Starters",  order: 0 },
    { menuId: dinnerMenu.id, name: "Pasta",     order: 1 },
    { menuId: dinnerMenu.id, name: "Mains",     order: 2 },
    { menuId: dinnerMenu.id, name: "Desserts",  order: 3 },
  ]);

  await MenuItem.bulkCreate([
    // Starters
    { groupId: starters.id, name: "Bruschetta al Pomodoro",   price: 9.50,  description: "Toasted bread with fresh tomatoes, basil and extra-virgin olive oil.", dietaryTags: ["vegan"], order: 0 },
    { groupId: starters.id, name: "Burrata con Prosciutto",   price: 14.00, description: "Creamy burrata, San Daniele prosciutto, cherry tomatoes.", dietaryTags: [], order: 1 },
    { groupId: starters.id, name: "Zuppa di Funghi",          price: 11.00, description: "Wild mushroom soup with truffle oil and sourdough croutons.", dietaryTags: ["vegetarian", "gluten-free"], order: 2 },
    { groupId: starters.id, name: "Calamari Fritti",          price: 13.50, description: "Crispy fried calamari with lemon aioli and marinara sauce.", dietaryTags: [], order: 3 },
    // Pasta
    { groupId: pasta.id, name: "Tagliatelle al Ragù",         price: 18.00, description: "Hand-rolled tagliatelle with slow-cooked Bolognese ragù.", dietaryTags: [], order: 0 },
    { groupId: pasta.id, name: "Pappardelle ai Funghi Porcini", price: 19.50, description: "Wide pasta ribbons with porcini mushrooms, thyme and Parmigiano.", dietaryTags: ["vegetarian"], order: 1 },
    { groupId: pasta.id, name: "Spaghetti alle Vongole",      price: 21.00, description: "Spaghetti with Manila clams, white wine, garlic and chilli.", dietaryTags: ["dairy-free"], order: 2 },
    { groupId: pasta.id, name: "Risotto al Limone",           price: 17.50, description: "Carnaroli risotto with Amalfi lemon, Parmigiano and fresh herbs.", dietaryTags: ["vegetarian", "gluten-free"], order: 3 },
    // Mains
    { groupId: mains.id, name: "Branzino al Forno",           price: 28.00, description: "Whole roasted sea bass with capers, olives and roasted potatoes.", dietaryTags: ["gluten-free", "dairy-free"], order: 0 },
    { groupId: mains.id, name: "Costolette d'Agnello",        price: 32.00, description: "Rack of lamb with rosemary jus, grilled vegetables and polenta.", dietaryTags: ["gluten-free"], order: 1 },
    { groupId: mains.id, name: "Pollo alla Milanese",         price: 24.00, description: "Breaded chicken breast with rocket, cherry tomatoes and lemon.", dietaryTags: [], order: 2 },
    { groupId: mains.id, name: "Melanzane alla Parmigiana",   price: 19.00, description: "Baked aubergine with San Marzano tomato, mozzarella and basil.", dietaryTags: ["vegetarian", "gluten-free"], order: 3 },
    // Desserts
    { groupId: desserts.id, name: "Tiramisù Classico",        price: 9.00,  description: "House-made tiramisù with mascarpone and savoiardi biscuits.", dietaryTags: [], order: 0 },
    { groupId: desserts.id, name: "Panna Cotta alla Vaniglia", price: 8.50, description: "Set vanilla cream with seasonal berry compote.", dietaryTags: ["vegetarian", "gluten-free"], order: 1 },
    { groupId: desserts.id, name: "Tortino al Cioccolato",    price: 10.00, description: "Warm dark chocolate fondant with pistachio gelato.", dietaryTags: ["vegetarian", "nuts"], order: 2 },
    { groupId: desserts.id, name: "Sorbetto al Limone",       price: 7.50,  description: "Amalfi lemon sorbet served in the shell.", dietaryTags: ["vegan", "gluten-free", "dairy-free"], order: 3 },
  ]);

  const drinksMenu = await Menu.create({
    restaurantId: restaurant.id,
    name: "Drinks Menu",
    type: MenuType.STRUCTURED,
    layoutStyle: LayoutStyle.TWO_COLUMN,
    order: 1,
  });

  const [wines, cocktails, softDrinks] = await MenuGroup.bulkCreate([
    { menuId: drinksMenu.id, name: "Wine",        order: 0 },
    { menuId: drinksMenu.id, name: "Cocktails",   order: 1 },
    { menuId: drinksMenu.id, name: "Soft Drinks", order: 2 },
  ]);

  await MenuItem.bulkCreate([
    // Wine
    { groupId: wines.id, name: "Barolo DOCG — Piedmont",       price: 14.00, description: "Full-bodied red, notes of cherry and leather. Glass.", dietaryTags: ["vegan"], order: 0 },
    { groupId: wines.id, name: "Chianti Classico Riserva",     price: 12.00, description: "Tuscan red, medium body, dried fruit finish. Glass.", dietaryTags: ["vegan"], order: 1 },
    { groupId: wines.id, name: "Pinot Grigio delle Venezie",   price: 10.00, description: "Crisp white, citrus and pear. Glass.", dietaryTags: ["vegan"], order: 2 },
    { groupId: wines.id, name: "Prosecco DOC Extra Dry",       price: 9.50,  description: "Fine bubbles, apple blossom, delicate sweetness. Glass.", dietaryTags: ["vegan"], order: 3 },
    // Cocktails
    { groupId: cocktails.id, name: "Aperol Spritz",            price: 11.00, description: "Aperol, Prosecco, soda, fresh orange slice.", dietaryTags: [], order: 0 },
    { groupId: cocktails.id, name: "Negroni",                  price: 13.00, description: "Gin, Campari, sweet vermouth, orange peel.", dietaryTags: [], order: 1 },
    { groupId: cocktails.id, name: "Hugo",                     price: 10.00, description: "Elderflower cordial, Prosecco, fresh mint, lime.", dietaryTags: [], order: 2 },
    { groupId: cocktails.id, name: "Limoncello Sour",          price: 12.00, description: "Limoncello, lemon juice, egg white, Angostura bitters.", dietaryTags: [], order: 3 },
    // Soft Drinks
    { groupId: softDrinks.id, name: "San Pellegrino",          price: 4.00,  description: "Sparkling mineral water 750ml.", dietaryTags: ["vegan"], order: 0 },
    { groupId: softDrinks.id, name: "Acqua Panna",             price: 4.00,  description: "Still mineral water 750ml.", dietaryTags: ["vegan"], order: 1 },
    { groupId: softDrinks.id, name: "Limonata Artigianale",    price: 5.50,  description: "House-made lemonade with fresh mint.", dietaryTags: ["vegan", "gluten-free"], order: 2 },
    { groupId: softDrinks.id, name: "Caffè Espresso",          price: 3.50,  description: "Single or double shot Italian espresso.", dietaryTags: ["vegan", "gluten-free", "dairy-free"], order: 3 },
  ]);

  console.log("Menus created.");
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
