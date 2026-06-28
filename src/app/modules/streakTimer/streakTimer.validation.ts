import { z } from "zod";

const createStreakTimerValidation = z.object({
  body: z.object({
    title: z.string({
      required_error: "Title is required",
    }),
    days: z.number({
      required_error: "Days is required",
    }).int().positive(),
    points: z.number({
      required_error: "Points is required",
    }).int().positive(),
  }),
});

const updateStreakTimerValidation = z.object({
  body: z.object({
    title: z.string().optional(),
    days: z.number().int().positive().optional(),
    points: z.number().int().positive().optional(),
  }),
});

export const streakTimerValidation = {
  createStreakTimerValidation,
  updateStreakTimerValidation,
};
