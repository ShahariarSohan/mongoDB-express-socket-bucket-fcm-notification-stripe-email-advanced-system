import { Router } from "express";
import { testController } from "./test.controller";
import auth from "../../middleware/auth";
import { Role } from "@prisma/client";

const route = Router();

// Test step reminder notification (Admin only)
route.post("/step-reminder", auth(Role.ADMIN), testController.testStepReminderController);

export const testRoutes = route;
