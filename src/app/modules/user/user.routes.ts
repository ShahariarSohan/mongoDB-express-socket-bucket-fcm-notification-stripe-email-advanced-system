import { Router } from "express";
import validateRequest from "../../middleware/validateRequest";
import { userController } from "./user.controller";
import { userValidation } from "./user.validation";

import auth from "../../middleware/auth";
import { Role } from "@prisma/client";
import { fileUploader } from "../../helper/uploadFile";
import { parseBodyMiddleware } from "../../middleware/parseBodyData";

const route = Router();

// Get all users (Admin only)
route.get("/", auth(Role.ADMIN), userController.getAllUsersController);

route.post(
  "/create",
  validateRequest(userValidation.createUser),
  userController.createUserController
);

route.patch(
  "/change-password",
  auth(),
  userController.changePasswordController
);

route.patch(
  "/me",
  auth(),
  fileUploader.uploadProfileImage,
  parseBodyMiddleware,
  userController.updateUserController
);

route.get("/me", auth(), userController.getMyProfileController);

// Get my referral code and referral stats
route.get("/my-referral-code", auth(), userController.getReferralInfoController);

// Send referral invite to another logged-in user
route.post("/send-referral-invite", auth(), userController.sendReferralInviteController);

// Accept referral code (logged-in user enters referral code)
route.post("/accept-referral-code", auth(), userController.acceptReferralCodeController);

// Add referral code (can add multiple times)
route.post("/add-referral-code", auth(), userController.addReferralCodeController);

// Get my referral connections
route.get("/my-referral-connections", auth(), userController.getMyReferralConnectionsController);

route.delete("/delete-me", auth(), userController.deleteMeController);

route.get("/:id", auth(), userController.getUserByIdController);

route.delete("/:id", auth(Role.ADMIN), userController.deleteUserController);


export const userRoutes = route;
  
