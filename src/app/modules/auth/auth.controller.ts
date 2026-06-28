import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import ApiError from "../../error/ApiErrors";
// import { userServices } from "../user/userService";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { authService } from "./auth.service";
import { getResponseMessage } from "../../helper/languageHelper";

const logInUserController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body
  const language = req.language || 'en';
  const result = await authService.logInFromDB(body, language);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("auth.login", language),
    data: result,
  });
});

const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as any;
  const language = req.language || 'en';

  const result = await authService.verifyOtp(body, language);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("auth.otpVerified", language),
    data: result,
  });
});


const forgetPasswordController = catchAsync(
  async (req: Request, res: Response) => {
    const body = req.body
    const language = req.language || 'en';
    const result = await authService.forgetPassword(body, language);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: getResponseMessage("auth.forgetPassword", language),
      data: result,
    });
  }
);


const resetOtpVerifyController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body;
  const language = req.language || 'en';
  const result = await authService.resetOtpVerify(body, language);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("auth.resetOtpVerified", language),
    data: result,
  });
})


const resendOtpController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body;
  const language = req.language || 'en';
  const result = await authService.resendOtp(body, language);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("auth.otpResent", language),
    data: result,
  });
});


const socialLoginController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body;
  const language = req.language || 'en';
  const result = await authService.socialLogin(body, language);
  sendResponse(res, {statusCode : StatusCodes.OK, success : true, message : getResponseMessage("auth.socialLogin", language), data : result});
})

const logoutController = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const language = req.language || 'en';
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized!");
  }

  await authService.logout(userId, language);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("auth.logout", language),
    data: null,
  });
});

const resetPasswordController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body;
  const language = req.language || 'en';

  const result = await authService.resetPassword(body, language);
  sendResponse(res, {statusCode : StatusCodes.OK, success : true, message : getResponseMessage("auth.passwordReset", language), data : result});
})

export const authController = {
  logInUserController,
  forgetPasswordController,
  verifyOtp,
  resendOtpController,
  socialLoginController,
  logoutController,
  resetOtpVerifyController,
  resetPasswordController
};
