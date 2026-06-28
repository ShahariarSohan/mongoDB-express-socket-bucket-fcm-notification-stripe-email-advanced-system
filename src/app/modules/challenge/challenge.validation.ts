import { ChallengeCategory } from "@prisma/client";
import { z } from "zod";

export const createChallengeValidation = z.object({
  name: z.string({ required_error: "Challenge name is required" }).min(1),
  description: z.string().optional(),
  category: z.nativeEnum(ChallengeCategory, {
    required_error: "Category is required",
  }),
  durationWeeks: z
    .number({ required_error: "Duration is required" })
    .int("Duration must be an integer")
    .min(1, "Duration must be at least 1 week")
    .max(52, "Duration cannot exceed 52 weeks"),
  startDate: z.string({ required_error: "Start date is required" }),
  inviteeUserIds: z.array(z.string()).optional(),
});

export const inviteUsersValidation = z.object({
  userIds: z.array(z.string()).min(1, "At least one user ID is required"),
});

export const challengeValidation = {
  createChallengeValidation,
  inviteUsersValidation,
};
