import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { dealService } from "./deal.service";
import { getResponseMessage } from "../../helper/languageHelper";

// Create Deal
const createDeal = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const language = req.language || 'en';
  const result = await dealService.createDealIntoDB(userId, req.body, req.files, language);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: getResponseMessage("deal.created", language),
    data: result,
  });
});

// Get Nearby Deals (within 10km)
const getNearbyDeals = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const language = req.language || 'en';
  const result = await dealService.getNearbyDealsFromDB(userId, req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.retrieved", language),
    data: result.data,
    meta: result.meta,
  });
});

// Get Single Deal
const getSingleDeal = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user?.id;
  const language = req.language || 'en';
  const result = await dealService.getSingleDealFromDB(req.params.id, userId, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.retrieved", language),
    data: result,
  });
});

// Get All Deals
const getAllDeals = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user?.id; // Optional user for distance calculation
  const language = req.language || 'en';
  const result = await dealService.getAllDealsFromDB(req.query, userId, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.retrieved", language),
    data: result.data,
    meta: result.meta,
  });
});

// Update Deal
const updateDeal = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;
  const language = req.language || 'en';
  const result = await dealService.updateDealIntoDB(userId, id, req.body, req.files, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.updated", language),
    data: result,
  });
});

// Delete Deal
const deleteDeal = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;
  const language = req.language || 'en';
  const result = await dealService.deleteDealFromDB(userId, id, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.deleted", language),
    data: null,
  });
});

// Delete Deal by Admin
const deleteDealByAdmin = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const language = req.language || 'en';
  const result = await dealService.deleteDealByAdminFromDB(id, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.deleted", language),
    data: null,
  });
});

// Add to favourites
const addToFavourites = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { dealId } = req.body;
  const language = req.language || 'en';
  const result = await dealService.addToFavourites(userId, dealId, language);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: getResponseMessage("success.created", language),
    data: result,
  });
});

// Remove from favourites
const removeFromFavourites = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;
  const language = req.language || 'en';
  const result = await dealService.removeFromFavourites(userId, id, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("success.deleted", language),
    data: null,
  });
});

// Get favourite deals
const getFavouriteDeals = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const language = req.language || 'en';
  const result = await dealService.getFavouriteDeals(userId, req.query, language) as any;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("deal.retrieved", language),
    data: result.data,
    meta: result.meta,
  });
});

// Check if deal is favourite
const checkIsFavourite = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;
  const language = req.language || 'en';
  const result = await dealService.isFavourite(userId, id, language);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("success.retrieved", language),
    data: result,
  });
});

export const dealController = {
  createDeal,
  getNearbyDeals,
  getSingleDeal,
  getAllDeals,
  updateDeal,
  deleteDeal,
  deleteDealByAdmin,
  addToFavourites,
  removeFromFavourites,
  getFavouriteDeals,
  checkIsFavourite,
};
