import { Router } from "express";
import auth from "../../middleware/auth";
import { shopController } from "./shop.controller";
import { fileUploader } from "../../helper/uploadFile";
import validateRequest from "../../middleware/validateRequest";

import { parseBodyMiddleware } from "../../middleware/parseBodyData";
import { Role } from "@prisma/client";

const router = Router();

/**
 * @route   POST /api/v1/shops
 * @desc    Create a new shop (Authenticated)
 * @access  Private
 */
router.post(
  "/",
  
  fileUploader.upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "coverPhoto", maxCount: 1 },
    { name: "kvk", maxCount: 1 }
  ]),
  parseBodyMiddleware,

  shopController.createShop
);

/**
 * @route   GET /api/v1/shops
 * @desc    Get all shops with pagination and filters
 * @access  Public
 */
router.get("/", shopController.getAllShops);

/**
 * @route   GET /api/v1/shops/my-shops
 * @desc    Get logged-in user's shops with deals
 * @access  Private
 */
router.get("/my-shops", auth(), shopController.getMyShops);

/**
 * @route   GET /api/v1/shops/admin/pending
 * @desc    Get all pending shops (Admin only)
 * @access  Admin
 */
router.get("/admin/pending", auth(Role.ADMIN, Role.SUPER_ADMIN), shopController.getPendingShops);

/**
 * @route   GET /api/v1/shops/admin/rejected
 * @desc    Get all rejected shops (Admin only)
 * @access  Admin
 */
router.get("/admin/rejected", auth(Role.ADMIN, Role.SUPER_ADMIN), shopController.getRejectedShops);

/**
 * @route   GET /api/v1/shops/admin/dashboard-stats
 * @desc    Get admin dashboard statistics (total users, shops, deals, revenue, etc.)
 * @access  Admin
 */
router.get("/admin/dashboard-stats", auth(Role.ADMIN, Role.SUPER_ADMIN), shopController.getAdminDashboardStats);

/**
 * @route   GET /api/v1/shops/admin/all-shops
 * @desc    Get all shops (approved, rejected, pending) with free trial info
 * @access  Admin
 */
router.get("/admin/all-shops", auth(Role.ADMIN, Role.SUPER_ADMIN), shopController.getAdminAllShops);

/**
 * @route   GET /api/v1/shops/:shopId/analytics
 * @desc    Get shop analytics (deals, vouchers, views)
 * @access  Private
 */
router.get("/:shopId/analytics", auth(Role.SHOP_OWNER,Role.ADMIN), shopController.getShopAnalytics);

/**
 * @route   GET /api/v1/shops/:shopId/activity
 * @desc    Get shop recent activity
 * @access  Private
 */
router.get("/:shopId/activity", auth(Role.SHOP_OWNER, Role.ADMIN), shopController.getShopRecentActivity);

/**
 * @route   GET /api/v1/shops/:shopId/deals
 * @desc    Get all deals of a shop (logged-in user's shop)
 * @access  Private
 */
router.get("/:shopId/deals", auth(Role.USER, Role.ADMIN,Role.SHOP_OWNER), shopController.getShopDeals);

/**
 * @route   GET /api/v1/shops/:shopId/vouchers
 * @desc    Get all shop vouchers - all deals with users who claimed them
 * @access  Private (Shop Owner)
 */
router.get("/:shopId/vouchers", auth(Role.SHOP_OWNER, Role.ADMIN), shopController.getAllShopVouchers);

/**
 * @route   GET /api/v1/shops/:shopId/subscription-days
 * @desc    Get remaining free subscription days
 * @access  Private (Shop Owner)
 */
router.get("/:shopId/subscription-days", auth(Role.SHOP_OWNER, Role.ADMIN), shopController.getFreeSubscriptionDays);

/**
 * @route   GET /api/v1/shops/:shopId/best-deals
 * @desc    Get best deals based on voucher claims and redemptions
 * @query   sortBy: 'claimCount' | 'redemptionRate' | 'combined' (default: redemptionRate)
 * @access  Private (Shop Owner)
 */
router.get("/:shopId/best-deals", auth(Role.SHOP_OWNER, Role.ADMIN), shopController.getBestDealsByPercentage);

/**
 * @route   GET /api/v1/shops/:shopId/deals/:dealId/vouchers
 * @desc    Get deal vouchers (who claimed/redeemed)
 * @access  Private (Shop Owner)
 */
router.get("/:shopId/deals/:dealId/vouchers", auth(Role.SHOP_OWNER, Role.ADMIN), shopController.getDealVouchers);

/**
 * @route   GET /api/v1/shops/:shopId/top-redeemed
 * @desc    Get top redeemed deals with analytics
 * @access  Private (Shop Owner)
 */
router.get("/:shopId/top-redeemed", auth(Role.SHOP_OWNER, Role.ADMIN), shopController.getTopRedeemedDeals);

/**
 * @route   GET /api/v1/shops/:id
 * @desc    Get single shop with deals
 * @access  Public/Private (optional auth)
 */
router.get("/:id", auth(), shopController.getSingleShop);

/**
 * @route   PATCH /api/v1/shops/:id
 * @desc    Update shop
 * @access  Private
 */
router.patch(
  "/:id",
  auth(Role.ADMIN,Role.SHOP_OWNER),
  fileUploader.upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "coverPhoto", maxCount: 1 },
    { name: "kvk", maxCount: 1 }
  ]),
  parseBodyMiddleware,
  shopController.updateShop
);

/**
 * @route   DELETE /api/v1/shops/:id
 * @desc    Delete shop by owner
 * @access  Private
 */
router.delete("/:id", auth( Role.ADMIN, Role.SHOP_OWNER), shopController.deleteShop);

/**
 * @route   DELETE /api/v1/shops/:id/admin
 * @desc    Delete shop by admin
 * @access  Admin
 */
router.delete("/:id/admin", auth("ADMIN", "SUPER_ADMIN"), shopController.deleteShopByAdmin);

/**
 * @route   PATCH /api/v1/shops/:id/status
 * @desc    Update shop status (Approve/Reject) - Admin only
 * @access  Admin
 */
router.patch("/:id/status", auth(Role.ADMIN, Role.SUPER_ADMIN), shopController.updateShopStatus);

export const shopRoutes = router;
