import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { paymentService } from "./payment.service";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { getResponseMessage } from "../../helper/languageHelper";

const createPaymentController = catchAsync(
  async (req: Request, res: Response) => {
    const payload = req.body as any;
    const { id: userId } = req.user;
    const language = req.language || 'en';

    const result = await paymentService.createIntentInStripe(payload, userId, language);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: getResponseMessage("payment.created", language),
      data: result,
      success: true,
    });
  }
);

const saveCardController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as any;
  const { id: userId } = req.user;
  const language = req.language || 'en';
  const payload = { ...body, userId };

  const result = await paymentService.saveCardInStripe(payload);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: getResponseMessage("success.created", language),
    data: result,
    success: true,
  });
});

const getSaveCardController = catchAsync(
  async (req: Request, res: Response) => {
    const { id: userId } = req.user;
    const language = req.language || 'en';
    const result = await paymentService.getSaveCardsFromStripe(userId, language);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      message: getResponseMessage("payment.retrieved", language),
      data: result,
      success: true,
    });
  }
);

const deleteCardController = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body as any;
  const { id: userId } = req.user;
  const language = req.language || 'en';
  const result = await paymentService.deleteCardFromStripe(
    userId,
    payload.last4,
    language
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    message: getResponseMessage("success.deleted", language),
    data: result,
    success: true,
  });
});

export const paymentController = {
  createPaymentController,
  saveCardController,
  getSaveCardController,
  deleteCardController,
};
