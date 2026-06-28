import { Router } from "express";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";
import { challengeController } from "./challenge.controller";
import { challengeValidation } from "./challenge.validation";

const router = Router();

router.post(
  "/",
  auth(),
  validateRequest(challengeValidation.createChallengeValidation),
  challengeController.createChallenge
);

router.post(
  "/:challengeId/invite",
  auth(),
  validateRequest(challengeValidation.inviteUsersValidation),
  challengeController.inviteUsers
);

router.post(
  "/invitations/:invitationId/accept",
  auth(),
  challengeController.acceptInvitation
);

router.post(
  "/:challengeId/leave",
  auth(),
  challengeController.leaveChallenge
);

router.delete(
  "/:challengeId",
  auth(),
  challengeController.deleteChallenge
);

router.get(
  "/my/ongoing",
  auth(),
  challengeController.getMyOngoingChallenges
);

router.get(
  "/my/completed",
  auth(),
  challengeController.getMyCompletedChallenges
);

router.get(
  "/my/upcoming",
  auth(),
  challengeController.getMyUpcomingChallenges
);

router.get(
  "/my/cancelled",
  auth(),
  challengeController.getMyCancelledChallenges
);

router.get(
  "/my/invitations",
  auth(),
  challengeController.getMyInvitations
);

router.get(
  "/:challengeId",
  auth(),
  challengeController.getSingleChallenge
);

export const challengeRoutes = router;
