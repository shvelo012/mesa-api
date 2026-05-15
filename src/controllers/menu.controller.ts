import { Response } from "express";
import { z } from "zod";
import { Restaurant } from "../models/Restaurant";
import { Menu, MenuType, LayoutStyle } from "../models/Menu";
import { MenuPhoto } from "../models/MenuPhoto";
import { MenuGroup } from "../models/MenuGroup";
import { MenuItem } from "../models/MenuItem";
import { AuthRequest } from "../middleware/auth";
import { saveFile, deleteFile } from "../lib/storage";

const DIETARY_TAGS = ["vegan", "vegetarian", "gluten-free", "dairy-free", "spicy", "nuts"] as const;

async function ownerRestaurant(userId: string) {
  return Restaurant.findOne({ where: { ownerId: userId } });
}

async function ownerMenu(menuId: string, restaurantId: string) {
  return Menu.findOne({ where: { id: menuId, restaurantId } });
}

// GET /api/menus/restaurant
export async function getRestaurantMenus(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menus = await Menu.findAll({
    where: { restaurantId: restaurant.id },
    include: [
      { model: MenuPhoto, as: "photos", order: [["order", "ASC"]] },
      {
        model: MenuGroup, as: "groups", order: [["order", "ASC"]],
        include: [{ model: MenuItem, as: "items", order: [["order", "ASC"]] }],
      },
    ],
    order: [["order", "ASC"]],
  });
  res.json(menus);
}

// POST /api/menus
const createMenuSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(MenuType),
  layoutStyle: z.nativeEnum(LayoutStyle).optional(),
  groups: z.array(z.string()).optional(), // preset group names
});

export async function createMenu(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const parsed = createMenuSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { groups, ...menuData } = parsed.data;
  const count = await Menu.count({ where: { restaurantId: restaurant.id } });
  const menu = await Menu.create({ ...menuData, restaurantId: restaurant.id, order: count });

  if (menuData.type === MenuType.STRUCTURED && groups?.length) {
    await MenuGroup.bulkCreate(
      groups.map((name, i) => ({ menuId: menu.id, name, order: i }))
    );
  }

  const full = await Menu.findByPk(menu.id, {
    include: [
      { model: MenuPhoto, as: "photos" },
      { model: MenuGroup, as: "groups", include: [{ model: MenuItem, as: "items" }] },
    ],
  });
  res.status(201).json(full);
}

// PUT /api/menus/:id
const updateMenuSchema = z.object({
  name: z.string().min(1).optional(),
  layoutStyle: z.nativeEnum(LayoutStyle).optional(),
});

export async function updateMenu(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const parsed = updateMenuSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  await menu.update(parsed.data);
  res.json(menu);
}

// DELETE /api/menus/:id
export async function deleteMenu(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await Menu.findOne({
    where: { id: req.params.id, restaurantId: restaurant.id },
    include: [{ model: MenuPhoto, as: "photos" }],
  });
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  // delete uploaded files
  await Promise.all(menu.photos.map((p) => deleteFile(p.url)));
  await menu.destroy();
  res.status(204).send();
}

// POST /api/menus/:id/photos  (multipart, field name "photos")
export async function uploadPhotos(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "No files uploaded" }); return; }

  const existing = await MenuPhoto.count({ where: { menuId: menu.id } });
  const urls = await Promise.all(files.map((f) => saveFile(f)));
  const photos = await MenuPhoto.bulkCreate(
    urls.map((url, i) => ({ menuId: menu.id, url, order: existing + i }))
  );
  res.status(201).json(photos);
}

// DELETE /api/menus/:id/photos/:photoId
export async function deletePhoto(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const photo = await MenuPhoto.findOne({ where: { id: req.params.photoId, menuId: menu.id } });
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

  await deleteFile(photo.url);
  await photo.destroy();
  res.status(204).send();
}

// POST /api/menus/:id/groups
export async function createGroup(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const count = await MenuGroup.count({ where: { menuId: menu.id } });
  const group = await MenuGroup.create({ menuId: menu.id, name: parsed.data.name, order: count });
  res.status(201).json(group);
}

// PUT /api/menus/:id/groups/:groupId
export async function updateGroup(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const group = await MenuGroup.findOne({ where: { id: req.params.groupId, menuId: menu.id } });
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const parsed = z.object({ name: z.string().min(1).optional(), order: z.number().int().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  await group.update(parsed.data);
  res.json(group);
}

// DELETE /api/menus/:id/groups/:groupId
export async function deleteGroup(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const group = await MenuGroup.findOne({ where: { id: req.params.groupId, menuId: menu.id } });
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  await group.destroy();
  res.status(204).send();
}

const itemSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  description: z.string().optional(),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)).default([]),
  order: z.number().int().optional(),
});

// POST /api/menus/:id/groups/:groupId/items
export async function createItem(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const group = await MenuGroup.findOne({ where: { id: req.params.groupId, menuId: menu.id } });
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const count = await MenuItem.count({ where: { groupId: group.id } });
  const item = await MenuItem.create({ ...parsed.data, groupId: group.id, order: parsed.data.order ?? count });
  res.status(201).json(item);
}

// PUT /api/menus/:id/groups/:groupId/items/:itemId
export async function updateItem(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const group = await MenuGroup.findOne({ where: { id: req.params.groupId, menuId: menu.id } });
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const item = await MenuItem.findOne({ where: { id: req.params.itemId, groupId: group.id } });
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  await item.update(parsed.data);
  res.json(item);
}

// DELETE /api/menus/:id/groups/:groupId/items/:itemId
export async function deleteItem(req: AuthRequest, res: Response) {
  const restaurant = await ownerRestaurant(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const menu = await ownerMenu(req.params.id, restaurant.id);
  if (!menu) { res.status(404).json({ error: "Menu not found" }); return; }

  const group = await MenuGroup.findOne({ where: { id: req.params.groupId, menuId: menu.id } });
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const item = await MenuItem.findOne({ where: { id: req.params.itemId, groupId: group.id } });
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  await item.destroy();
  res.status(204).send();
}

// GET /api/menus/public/:restaurantIdOrSlug
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublicMenus(req: AuthRequest, res: Response) {
  const { restaurantIdOrSlug } = req.params;
  const where = UUID_RE.test(restaurantIdOrSlug)
    ? { id: restaurantIdOrSlug }
    : { slug: restaurantIdOrSlug };

  const restaurant = await Restaurant.findOne({ where });
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

  const menus = await Menu.findAll({
    where: { restaurantId: restaurant.id },
    include: [
      { model: MenuPhoto, as: "photos", order: [["order", "ASC"]] },
      {
        model: MenuGroup, as: "groups", order: [["order", "ASC"]],
        include: [{ model: MenuItem, as: "items", order: [["order", "ASC"]] }],
      },
    ],
    order: [["order", "ASC"]],
  });
  res.json(menus);
}
