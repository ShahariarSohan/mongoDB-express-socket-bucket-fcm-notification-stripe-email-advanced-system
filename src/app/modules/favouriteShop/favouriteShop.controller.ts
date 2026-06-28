import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { favouriteShopService } from "./favouriteShop.service";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { getResponseMessage } from "../../helper/languageHelper";

const addFavouriteShopController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { shopId } = req.body;
  const language = req.language || 'en';
  
  const result = await favouriteShopService.addFavouriteShop(id, shopId, language);
  
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: "Shop added to favourites successfully",
    data: result,
    success: true,
  });
});

const removeFavouriteShopController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { shopId } = req.params;
  const language = req.language || 'en';
  
  const result = await favouriteShopService.removeFavouriteShop(id, shopId, language);
  
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    message: result.message,
    data: null,
    success: true,
  });
});

const getFavouriteShopsController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const language = req.language || 'en';
  
  const result = await favouriteShopService.getFavouriteShops(id, language);
  
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    message: "Favourite shops retrieved successfully",
    data: result,
    success: true,
  });
});

const isShopFavouriteController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { shopId } = req.params;
  
  const result = await favouriteShopService.isShopFavourite(id, shopId);
  
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    message: "Favourite status retrieved successfully",
    data: result,
    success: true,
  });
});

export const favouriteShopController = {
  addFavouriteShopController,
  removeFavouriteShopController,
  getFavouriteShopsController,
  isShopFavouriteController,
};
