import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { stepsService } from "./steps.service";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { getResponseMessage } from "../../helper/languageHelper";

const submitStepsController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const body = req.body;
  const language = req.language || 'en';
  const result = await stepsService.submitSteps(id, body, language);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: getResponseMessage("steps.created", language), 
    data: result, 
    success: true 
  });
});

const getHistoryController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const language = req.language || 'en';
  const result = await stepsService.getHistory(id, language);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: getResponseMessage("steps.retrieved", language), 
    data: result, 
    success: true 
  });
});

const getTotalPointsController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const language = req.language || 'en';
  const result = await stepsService.getTotalPoints(id, language);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: getResponseMessage("steps.retrieved", language), 
    data: result, 
    success: true 
  });
});

const getStreakInfoController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const result = await stepsService.getStreakInfo(id);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: "Streak information retrieved successfully", 
    data: result, 
    success: true 
  });
});

const getPointsStatisticsController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { days } = req.query;
  const result = await stepsService.getPointsStatistics(id, Number(days));
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: "Points statistics retrieved successfully", 
    data: result, 
    success: true 
  });
});

const getStreakMilestonesController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const result = await stepsService.getStreakMilestones(id);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: "Streak milestones retrieved successfully", 
    data: result, 
    success: true 
  });
});

const getLeaderboardController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const result = await stepsService.getLeaderboard(id, req.query);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: "Leaderboard retrieved successfully", 
    data: result.data,
    meta: result.meta,
    success: true 
  });
});

const getAllFriendsLeaderboardController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const result = await stepsService.getAllFriendsLeaderboard(id, req.query);
  sendResponse(res, { 
    statusCode: StatusCodes.OK, 
    message: "Friends leaderboard retrieved successfully", 
    data: result.data,
    meta: result.meta,
    success: true 
  });
});

export const stepsController = {
  submitStepsController,
  getHistoryController,
  getTotalPointsController,
  getStreakInfoController,
  getPointsStatisticsController,
  getStreakMilestonesController,
  getLeaderboardController,
  getAllFriendsLeaderboardController,
};
