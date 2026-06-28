import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { shopService } from "./shop.service";
import { getResponseMessage } from "../../helper/languageHelper";

// Create Shop
const createShop = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const verificationToken = req.headers.authorization?.replace("Bearer ", "");
  const language = req.language || 'en';
  
  if (!verificationToken) {
    throw new Error("Verification token is required");
  }
  
  const result = await shopService.createShopIntoDB(req.body, req.files, verificationToken, language);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: getResponseMessage("shop.created", language),
    data: result,
  });
});

// Get All Shops
const getAllShops = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await shopService.getAllShopsFromDB(req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.list", language),
    data: result.data,
    meta: result.meta,
  });
});

// Get Single Shop
const getSingleShop = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user?.id; // Optional - may not be logged in
  const language = req.language || 'en';
  const result = await shopService.getSingleShopFromDB(req.params.id, userId, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.retrieved", language),
    data: result,
  });
});

// Get My Shops
const getMyShops = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const language = req.language || 'en';
  const result = await shopService.getMyShopsFromDB(userId, req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.list", language),
    data: result.data,
    meta: result.meta,
  });
});

// Get Shop Analytics
const getShopAnalytics = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { shopId } = req.params;
  const language = req.language || 'en';
  const result = await shopService.getShopAnalyticsFromDB(userId, shopId, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.retrieved", language),
    data: result,
  });
});

// Get Shop Recent Activity
const getShopRecentActivity = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { shopId } = req.params;
  const language = req.language || 'en';
  const result = await shopService.getShopRecentActivityFromDB( userId,shopId,req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.retrieved", language),
    data: result.data,
    meta: result.meta,
  }); 
});

// Get Shop's Deals
const getShopDeals = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { shopId } = req.params;
  const language = req.language || 'en';
  const result = await shopService.getShopDealsFromDB(userId, shopId, req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.retrieved", language),
    data: result.data,
    meta: result.meta,
  });
});

// Update Shop
const updateShop = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;
  const language = req.language || 'en';
  const result = await shopService.updateShopIntoDB(userId, id, req.body, req.files, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.updated", language),
    data: result,
  });
});

// Delete Shop
const deleteShop = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;
  const language = req.language || 'en';
  const result = await shopService.deleteShopFromDB(userId, id, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.deleted", language),
    data: null,
  });
});

// Delete Shop by Admin
const deleteShopByAdmin = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const language = req.language || 'en';
  const result = await shopService.deleteShopByAdminFromDB(id, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.deleted", language),
    data: null,
  });
});

// Get Pending Shops (Admin only)
const getPendingShops = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await shopService.getPendingShopsFromDB(req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.list", language),
    data: result.data,
    meta: result.meta,
  });
});

// Get Rejected Shops (Admin only)
const getRejectedShops = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await shopService.getRejectedShopsFromDB(req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.list", language),
    data: result.data,
    meta: result.meta,
  });
});

// Update Shop Status (Admin only)
const updateShopStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const language = req.language || 'en';

  if (!status || !["APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Invalid status. Must be APPROVED or REJECTED");
  }

  const result = await shopService.updateShopStatusFromDB(id, status, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.updated", language),
    data: result,
  });
});

// Get Deal Vouchers (Who claimed/redeemed)
const getDealVouchers = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { shopId, dealId } = req.params;
  const language = req.language || 'en';
  const result = await shopService.getDealVouchersFromDB(userId, shopId, dealId, req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("voucher.retrieved", language),
    data: result.data,
    meta: result.meta,
  });
});

// Get Top Redeemed Deals
const getTopRedeemedDeals = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { shopId } = req.params;
  const language = req.language || 'en';
  const result = await shopService.getTopRedeemedDealsFromDB(userId, shopId, req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.retrieved", language),
    data: result.data,
    meta: result.meta,
  });
});

// Get All Shop Vouchers (All deals with users who claimed them)
const getAllShopVouchers = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { shopId } = req.params;
  const language = req.language || 'en';
  const result = await shopService.getAllShopVouchersFromDB(userId, shopId, req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("voucher.retrieved", language),
    data: result.data,
    meta: result.meta,
  });
});

// Get Remaining Free Subscription Days
const getFreeSubscriptionDays = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { shopId } = req.params;
  const language = req.language || 'en';
  const result = await shopService.getFreeSubscriptionDaysFromDB(userId, shopId, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("subscription.retrieved", language),
    data: result,
  });
});

// Get Best Deals by Percentage
const getBestDealsByPercentage = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { shopId } = req.params;
  const language = req.language || 'en';
  const result = await shopService.getBestDealsByPercentageFromDB(userId, shopId, req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.retrieved", language),
    data: result.data,
    meta: result.meta,
  });
});

// Get Admin Dashboard Statistics
const getAdminDashboardStats = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const language = req.language || 'en';
  const result = await shopService.getAdminDashboardStatsFromDB(language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("success.retrieved", language),
    data: result,
  });
});

// Get All Shops for Admin (Approved, Rejected, Pending)
const getAdminAllShops = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await shopService.getAdminAllShopsFromDB(req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("shop.list", language),
    data: result.data,
    meta: result.meta,
  });
});

export const shopController = {
  createShop,
  getAllShops,
  getSingleShop,
  getMyShops,
  getShopAnalytics,
  getShopRecentActivity,
  getShopDeals,
  updateShop,
  deleteShop,
  deleteShopByAdmin,
  getPendingShops,
  getRejectedShops,
  updateShopStatus,
  getDealVouchers,
  getTopRedeemedDeals,
  getAllShopVouchers,
  getFreeSubscriptionDays,
  getBestDealsByPercentage,
  getAdminDashboardStats,
  getAdminAllShops,
};
