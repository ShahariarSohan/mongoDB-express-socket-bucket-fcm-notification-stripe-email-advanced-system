import { Router } from "express";
import auth from "../../middleware/auth";
import { dealController } from "./deal.controller";
import { fileUploader } from "../../helper/uploadFile";
import validateRequest from "../../middleware/validateRequest";
import { Role } from "@prisma/client";
import { parseBodyMiddleware } from "../../middleware/parseBodyData";


const router = Router();

/**
 * @route   POST /api/v1/deals
 * @desc    Create a new deal (Authenticated)
 * @access  Private
 */
router.post(
  "/",
  auth(Role.SHOP_OWNER,Role.ADMIN),
  fileUploader.uploadDealAssets,
  parseBodyMiddleware,
  dealController.createDeal
);

/**
 * @route   GET /api/v1/deals/nearby
 * @desc    Get deals within 10km of logged-in user
 * @access  Private
 */
router.get("/nearby", auth(Role.USER, Role.ADMIN,Role.SHOP_OWNER), dealController.getNearbyDeals);

/**
 * @route   GET /api/v1/deals/favourites/list
 * @desc    Get user's favourite deals
 * @access  Private
 */
router.get("/favourites/list", auth(Role.USER, Role.ADMIN,Role.SHOP_OWNER), dealController.getFavouriteDeals);

/**
 * @route   POST /api/v1/deals/favourites
 * @desc    Add deal to favourites
 * @access  Private
 */
router.post("/favourites", auth(Role.USER, Role.ADMIN,Role.SHOP_OWNER), dealController.addToFavourites);

/**
 * @route   DELETE /api/v1/deals/favourites/:id
 * @desc    Remove deal from favourites
 * @access  Private
 */
router.delete("/favourites/:id", auth(Role.USER, Role.ADMIN,Role.SHOP_OWNER), dealController.removeFromFavourites);

/**
 * @route   GET /api/v1/deals/favourites/:id/check
 * @desc    Check if deal is in favourites
 * @access  Private
 */
router.get("/favourites/:id/check", auth(Role.USER, Role.ADMIN,Role.SHOP_OWNER), dealController.checkIsFavourite);

/**
 * @route   GET /api/v1/deals
 * @desc    Get all deals with pagination and filters (distance sorted if logged in)
 * @access  Public (distance calculated for logged-in users)
 */
router.get("/", auth(), dealController.getAllDeals);

/**
 * @route   GET /api/v1/deals/:id
 * @desc    Get single deal with shop details and distance
 * @access  Public/Private (distance calculated if logged in)
 */
router.get("/:id", auth(), dealController.getSingleDeal);

/**
 * @route   PATCH /api/v1/deals/:id
 * @desc    Update deal
 * @access  Private
 */
router.patch(
  "/:id",
  auth(Role.USER, Role.ADMIN,Role.SHOP_OWNER),
  fileUploader.uploadDealAssets,
  parseBodyMiddleware,
  dealController.updateDeal
);

/**
 * @route   DELETE /api/v1/deals/:id
 * @desc    Delete deal by owner
 * @access  Private
 */
router.delete("/:id", auth( Role.ADMIN,Role.SHOP_OWNER), dealController.deleteDeal);

/**
 * @route   DELETE /api/v1/deals/:id/admin
 * @desc    Delete deal by admin
 * @access  Admin
 */
router.delete("/:id/admin", auth(Role.ADMIN, Role.SUPER_ADMIN), dealController.deleteDealByAdmin);

export const dealRoutes = router;
