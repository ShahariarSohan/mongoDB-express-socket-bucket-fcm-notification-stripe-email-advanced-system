import { Router } from "express";
import auth from "../../middleware/auth";
import { Role } from "@prisma/client";
import { favouriteShopController } from "./favouriteShop.controller";

const router = Router();

// Add shop to favourites
router.post(
  "/",
  auth(Role.USER, Role.SHOP_OWNER),
  favouriteShopController.addFavouriteShopController
);

// Get all favourite shops
router.get(
  "/",
  auth(Role.USER, Role.SHOP_OWNER),
  favouriteShopController.getFavouriteShopsController
);

// Check if shop is favourite
router.get(
  "/check/:shopId",
  auth(Role.USER, Role.SHOP_OWNER),
  favouriteShopController.isShopFavouriteController
);

// Remove shop from favourites
router.delete(
  "/:shopId",
  auth(Role.USER, Role.SHOP_OWNER),
  favouriteShopController.removeFavouriteShopController
);

export const favouriteShopRoutes = router;
