import { Router } from "express";
import validateRequest from "../../middleware/validateRequest";
import { stepsController } from "./steps.controller";

import auth from "../../middleware/auth";

const route = Router();

// Submit or update daily steps
route.post(
  "/submit",
  auth(),
  stepsController.submitStepsController
);

// Get last 30 days history with streak info and total points
route.get(
  "/history",
  auth(),
  stepsController.getHistoryController
);

// Get user's total points
route.get(
  "/points",
  auth(),
  stepsController.getTotalPointsController
);

// Get streak information only
route.get(
  "/streak",
  auth(),
  stepsController.getStreakInfoController
);

// Get points statistics for 7, 30, 60, or 90 days
route.get(
  "/statistics",
  auth(),
  stepsController.getPointsStatisticsController
);

// Get all streak milestones with unlock status
route.get(
  "/milestones",
  auth(),
  stepsController.getStreakMilestonesController
);

// Get leaderboard (users with highest steps)
route.get(
  "/leaderboard",
  auth(),
  stepsController.getLeaderboardController
);

// Get friends leaderboard including zero steps
route.get(
  "/leaderboard/friends/all",
  auth(),
  stepsController.getAllFriendsLeaderboardController
);

export const stepsRoutes = route;
