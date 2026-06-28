import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { voucherService } from "./voucher.service";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { getResponseMessage } from "../../helper/languageHelper";

const claimVoucherController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { dealId } = req.body;
  const language = req.language || 'en';
  const result = await voucherService.claimVoucher(id, dealId, language);
  sendResponse(res, { 
    statusCode: StatusCodes.CREATED, 
    message: getResponseMessage("voucher.created", language), 
    data: result, 
    success: true 
  });
});

const redeemVoucherController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { id: voucherId } = req.params;
  const language = req.language || 'en';
  const result = await voucherService.redeemVoucher(id, voucherId, language);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: getResponseMessage("voucher.updated", language), 
    data: result, 
    success: true 
  });
});

const getUserVouchersController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const language = req.language || 'en';
  const { page = 1, limit = 10, ...query } = req.query;
  const result = await voucherService.getUserVouchers(id, Number(page), Number(limit), query, language) as any;
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: getResponseMessage("voucher.retrieved", language), 
    data: result.data, 
    success: true,
    meta: result.meta 
  });
});

const getSingleVoucherController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { id: voucherId } = req.params;
  const language = req.language || 'en';
  const result = await voucherService.getSingleVoucher(id, voucherId, language);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: getResponseMessage("voucher.details.retrieved", language), 
    data: result, 
    success: true 
  });
});

const getVoucherBarcodeController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { id: voucherId } = req.params;
  const language = req.language || 'en';
  const result = await voucherService.getVoucherBarcode(id, voucherId, language);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    message: getResponseMessage("voucher.retrieved", language),
    data: result,
    success: true,
  });
});

export const voucherController = {
  claimVoucherController,
  redeemVoucherController,
  getUserVouchersController,
  getSingleVoucherController,
  getVoucherBarcodeController,
};
