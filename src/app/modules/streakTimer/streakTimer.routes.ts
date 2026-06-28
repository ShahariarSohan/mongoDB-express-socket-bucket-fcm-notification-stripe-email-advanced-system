import { Router } from "express";
import validateRequest from "../../middleware/validateRequest";
import { streakTimerController } from "./streakTimer.controller";
import auth from "../../middleware/auth";
import { Role } from "@prisma/client";


const router = Router();

/**
 * @route   POST /api/v1/streak-timers
 * @desc    Create a new streak timer milestone (Admin only)
 * @access  Admin
 */
router.post(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN,Role.USER),

  streakTimerController.createStreakTimerController
);

/**
 * @route   GET /api/v1/streak-timers
 * @desc    Get all streak timers with pagination (Admin only)
 * @access  Admin
 */
router.get(
  "/",
  auth(),
  streakTimerController.getAllStreakTimersController
);

/**
 * @route   GET /api/v1/streak-timers/milestones
 * @desc    Get all streak milestones (Public - for displaying to users)
 * @access  Public/Private
 */
router.get(
  "/milestones",
  streakTimerController.getStreakMilestonesController
);

/**
 * @route   GET /api/v1/streak-timers/:id
 * @desc    Get single streak timer by ID (Admin only)
 * @access  Admin
 */
router.get(
  "/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  streakTimerController.getSingleStreakTimerController
);

/**
 * @route   PATCH /api/v1/streak-timers/:id
 * @desc    Update streak timer (Admin only)
 * @access  Admin
 */
router.patch(
  "/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  streakTimerController.updateStreakTimerController
);

/**
 * @route   DELETE /api/v1/streak-timers/:id
 * @desc    Delete streak timer (Admin only)
 * @access  Admin
 */
router.delete(
  "/:id",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  streakTimerController.deleteStreakTimerController
);

export const streakTimerRoutes = router;
