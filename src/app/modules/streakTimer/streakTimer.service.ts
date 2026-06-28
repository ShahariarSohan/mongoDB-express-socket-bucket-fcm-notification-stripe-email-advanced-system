import { StreakTimer } from "@prisma/client";
import { prisma } from "../../../utils/prisma";
import ApiError from "../../error/ApiErrors";
import { StatusCodes } from "http-status-codes";

import { streakTimerSearchableFields } from "./streakTimer.constants";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";

/**
 * Create a new streak timer milestone
 */
const createStreakTimer = async (payload: {
  title: string;
  days: number;
  points: number;
}, language: SupportedLanguage = 'en'): Promise<StreakTimer> => {
  // Check if streak timer with same days already exists
  const existingStreak = await prisma.streakTimer.findFirst({
    where: { days: payload.days },
  });

  if (existingStreak) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Streak timer for ${payload.days} days already exists`
    );
  }

  const result = await prisma.streakTimer.create({
    data: payload,
  });

  return translateObject(result, language);
};

/**
 * Get all streak timers with pagination
 */
const getAllStreakTimers = async (
  qury:any,
  language: SupportedLanguage = 'en'
) => {

    const { page = 1, limit = 10, sortBy = "days", sortOrder = "asc" } = qury;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

  const andConditions: any[] = [];

  // Search functionality
 

  // Filter by specific fields


  const whereConditions =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.streakTimer.findMany({
    where: whereConditions,
    skip,
    take: limitNum,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const total = await prisma.streakTimer.count({
    where: whereConditions,
  });

  const translatedData = await translateArray(result, language);

  return {
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
    data: translatedData,
  };
};

/**
 * Get single streak timer by ID
 */
const getSingleStreakTimer = async (id: string, language: SupportedLanguage = 'en'): Promise<StreakTimer> => {
  const result = await prisma.streakTimer.findUnique({
    where: { id },
  });

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Streak timer not found");
  }

  return translateObject(result, language);
};

/**
 * Update streak timer
 */
const updateStreakTimer = async (
  id: string,
  payload: Partial<StreakTimer>,
  language: SupportedLanguage = 'en'
): Promise<StreakTimer> => {
  // Check if streak timer exists
  const existingStreak = await prisma.streakTimer.findUnique({
    where: { id },
  });

  if (!existingStreak) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Streak timer not found");
  }

  // If updating days, check if another streak with same days exists
  if (payload.days && payload.days !== existingStreak.days) {
    const duplicateStreak = await prisma.streakTimer.findFirst({
      where: {
        days: payload.days,
        id: { not: id },
      },
    });

    if (duplicateStreak) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `Streak timer for ${payload.days} days already exists`
      );
    }
  }

  const result = await prisma.streakTimer.update({
    where: { id },
    data: payload,
  });

  return translateObject(result, language);
};

/**
 * Delete streak timer
 */
const deleteStreakTimer = async (id: string, language: SupportedLanguage = 'en'): Promise<StreakTimer> => {
  const existingStreak = await prisma.streakTimer.findUnique({
    where: { id },
  });

  if (!existingStreak) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Streak timer not found");
  }

  const result = await prisma.streakTimer.delete({
    where: { id },
  });

  return translateObject(result, language);
};

/**
 * Get all active streak milestones (for client display)
 */
const getStreakMilestones = async (language: SupportedLanguage = 'en') => {
  const result = await prisma.streakTimer.findMany({
    orderBy: {
      days: "asc",
    },
  });

  return translateArray(result, language);
};

export const streakTimerService = {
  createStreakTimer,
  getAllStreakTimers,
  getSingleStreakTimer,
  updateStreakTimer,
  deleteStreakTimer,
  getStreakMilestones,
};
