import { Router } from "express";
import {
  getRestaurantMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  uploadPhotos,
  deletePhoto,
  createGroup,
  updateGroup,
  deleteGroup,
  createItem,
  updateItem,
  deleteItem,
  getPublicMenus,
} from "../controllers/menu.controller";
import { authenticate } from "../middleware/auth";
import { upload } from "../lib/storage";

const router = Router();
const owner = [authenticate];

router.get("/public/:restaurantIdOrSlug", getPublicMenus);
router.get("/restaurant", ...owner, getRestaurantMenus);
router.post("/", ...owner, createMenu);
router.put("/:id", ...owner, updateMenu);
router.delete("/:id", ...owner, deleteMenu);

router.post("/:id/photos", ...owner, upload.array("photos", 10), uploadPhotos);
router.delete("/:id/photos/:photoId", ...owner, deletePhoto);

router.post("/:id/groups", ...owner, createGroup);
router.put("/:id/groups/:groupId", ...owner, updateGroup);
router.delete("/:id/groups/:groupId", ...owner, deleteGroup);

router.post("/:id/groups/:groupId/items", ...owner, createItem);
router.put("/:id/groups/:groupId/items/:itemId", ...owner, updateItem);
router.delete("/:id/groups/:groupId/items/:itemId", ...owner, deleteItem);

export default router;
