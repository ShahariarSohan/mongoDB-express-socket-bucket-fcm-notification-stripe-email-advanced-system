import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { streakTimerService } from "./streakTimer.service";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { streakTimerFilterableFields } from "./streakTimer.constants";
import pick from "../../../shared/pick";
import { getResponseMessage } from "../../helper/languageHelper";


const createStreakTimerController = catchAsync(
  async (req: Request, res: Response) => {
    const language = req.language || 'en';
    const result = await streakTimerService.createStreakTimer(req.body, language);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: getResponseMessage("success.created", language),
      data: result,
      success: true,
    });
  }
);

const getAllStreakTimersController = catchAsync(
  async (req: Request, res: Response) => {
    const language = req.language || 'en';
    const result = await streakTimerService.getAllStreakTimers(req.query, language);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      message: getResponseMessage("success.retrieved", language),
      data: result.data,
      meta: result.meta,
      success: true,
    });
  }
);

const getSingleStreakTimerController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const language = req.language || 'en';
    const result = await streakTimerService.getSingleStreakTimer(id, language);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      message: getResponseMessage("success.retrieved", language),
      data: result,
      success: true,
    });
  }
);

const updateStreakTimerController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const language = req.language || 'en';
    const result = await streakTimerService.updateStreakTimer(id, req.body, language);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      message: getResponseMessage("success.updated", language),
      data: result,
      success: true,
    });
  }
);

const deleteStreakTimerController = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await streakTimerService.deleteStreakTimer(id);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      message: "Streak timer deleted successfully",
      data: result,
      success: true,
    });
  }
);

const getStreakMilestonesController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await streakTimerService.getStreakMilestones();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      message: "Streak milestones retrieved successfully",
      data: result,
      success: true,
    });
  }
);

export const streakTimerController = {
  createStreakTimerController,
  getAllStreakTimersController,
  getSingleStreakTimerController,
  updateStreakTimerController,
  deleteStreakTimerController,
  getStreakMilestonesController,
};
