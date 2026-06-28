import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../middleware/sendResponse";
import { challengeService } from "./challenge.service";

const createChallenge = catchAsync(async (req: Request, res: Response) => {
  const result = await challengeService.createChallenge(req.user.id, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Challenge created successfully",
    data: result,
  });
});

const inviteUsers = catchAsync(async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const result = await challengeService.inviteUsersToChallenge(challengeId, req.user.id, req.body.userIds);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Users invited successfully",
    data: result,
  });
});

const acceptInvitation = catchAsync(async (req: Request, res: Response) => {
  const { invitationId } = req.params;
  const result = await challengeService.acceptChallengeInvitation(invitationId, req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Challenge invitation accepted successfully",
    data: result,
  });
});

const leaveChallenge = catchAsync(async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const result = await challengeService.leaveChallenge(challengeId, req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "You have left the challenge successfully",
    data: result,
  });
});

const deleteChallenge = catchAsync(async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const result = await challengeService.deleteChallenge(challengeId, req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Challenge deleted successfully",
    data: result,
  });
});

const getSingleChallenge = catchAsync(async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const result = await challengeService.getSingleChallenge(challengeId, req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Challenge details retrieved successfully",
    data: result,
  });
});

const getMyOngoingChallenges = catchAsync(async (req: Request, res: Response) => {
  const result = await challengeService.getMyOngoingChallenges(req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ongoing challenges retrieved successfully",
    data: result,
  });
});

const getMyCompletedChallenges = catchAsync(async (req: Request, res: Response) => {
  const result = await challengeService.getMyCompletedChallenges(req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Completed challenges retrieved successfully",
    data: result,
  });
});

const getMyUpcomingChallenges = catchAsync(async (req: Request, res: Response) => {
  const result = await challengeService.getMyUpcomingChallenges(req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Upcoming challenges retrieved successfully",
    data: result,
  });
});

const getMyInvitations = catchAsync(async (req: Request, res: Response) => {
  const result = await challengeService.getMyInvitations(req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Challenge invitations retrieved successfully",
    data: result,
  });
});

const getMyCancelledChallenges = catchAsync(async (req: Request, res: Response) => {
  const result = await challengeService.getMyCancelledChallenges(req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Cancelled challenges retrieved successfully",
    data: result,
  });
});

export const challengeController = {
  createChallenge,
  inviteUsers,
  acceptInvitation,
  leaveChallenge,
  deleteChallenge,
  getSingleChallenge,
  getMyOngoingChallenges,
  getMyCompletedChallenges,
  getMyUpcomingChallenges,
  getMyCancelledChallenges,
  getMyInvitations,
};
