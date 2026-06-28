import { prisma } from "../../../utils/prisma";
import ApiError from "../../error/ApiErrors";
import { StatusCodes } from "http-status-codes";
import {
  POINTS_PER_2000_STEPS,
  MAX_DAILY_POINTS,
  MAX_DAILY_STEPS,
  STEPS_INCREMENT
} from "./steps.constants";
import { notificationServices } from "../notifications/notification.service";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";
import { challengeService } from "../challenge/challenge.service";
import { calculateCurrentStepsStreak } from "../../helper/currentStreakHelper";

// Calculate points based on steps (every 2000 steps = 20 points, max 60 points per day)
const calculatePoints = (steps: number): number => {
  if (steps >= MAX_DAILY_STEPS) {
    return MAX_DAILY_POINTS;
  }

  const multiplier = Math.floor(steps / STEPS_INCREMENT);
  return multiplier * POINTS_PER_2000_STEPS;
};

const getUTCStartOfDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const parseStepDateToUTCStart = (date?: string): Date => {
  if (!date) {
    return getUTCStartOfDay(new Date());
  }

  // Handle YYYY-MM-DD safely to avoid local timezone shifts
  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid date format. Use YYYY-MM-DD.');
  }

  return getUTCStartOfDay(parsedDate);
};

const isSameUTCDate = (first: Date, second: Date): boolean =>
  first.getUTCFullYear() === second.getUTCFullYear() &&
  first.getUTCMonth() === second.getUTCMonth() &&
  first.getUTCDate() === second.getUTCDate();

// Send streak milestone notifications
const sendStreakNotification = async (userId: string, currentStreak: number, previousStreak: number, language: SupportedLanguage = 'en') => {
  const milestones = [
    { days: 3, emoji: "🏅", message: "Great job! You've hit a 3-day streak!" },
    { days: 7, emoji: "🔥", message: "Amazing! You've maintained a 7-day streak!" },
    { days: 14, emoji: "💪", message: "Incredible! 2 weeks of consistent activity!" },
    { days: 21, emoji: "🌟", message: "Outstanding! 3 weeks streak achieved!" },
    { days: 30, emoji: "🏆", message: "Fantastic! You've completed 1 month of daily steps!" },
    { days: 60, emoji: "👑", message: "Legendary! 2 months streak - You're unstoppable!" },
  ];

  for (const milestone of milestones) {
    if (currentStreak >= milestone.days && previousStreak < milestone.days) {
      try {
        await notificationServices.sendSingleNotification(
          userId,
          userId,
          {
            title: `${milestone.emoji} Streak Milestone!`,
            body: milestone.message,
          }
        );
      } catch (error) {
        console.error(`Failed to send streak notification for ${milestone.days} days:`, error);
      }
      break; // Only send one milestone notification at a time
    }
  }
};

// Submit or update daily steps
const submitSteps = async (userId: string, payload: { steps: number; date?: string }, language: SupportedLanguage = 'en') => {
  const { steps, date } = payload;

  const stepDate = parseStepDateToUTCStart(date);
  const isSubmittedForToday = isSameUTCDate(stepDate, getUTCStartOfDay(new Date()));

  // Calculate points
  const points = calculatePoints(steps);

  // Check if steps already exist for this date
  const existingSteps = await prisma.steps.findFirst({
    where: {
      userId,
      date: stepDate,
    },
  });

  let result;
  let pointsDiff = 0;

  if (existingSteps) {
    // Update existing steps - only if new steps are greater or equal
    if (steps < existingSteps.steps) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Cannot update with lower steps. Current: ${existingSteps.steps}, Submitted: ${steps}. Please submit equal or higher steps for today.`
      );
    }

    const oldPoints = existingSteps.points;
    pointsDiff = points - oldPoints;

    result = await prisma.steps.update({
      where: {
        id: existingSteps.id,
      },
      data: {
        steps,
        points,
      },
    });
  } else {
    // Create new steps entry
    pointsDiff = points;

    result = await prisma.steps.create({
      data: {
        userId,
        steps,
        points,
        date: stepDate,
      },
    });
  }

  // Update user's total points and log in history
  const userPoints = await prisma.userPoints.findUnique({
    where: { userId },
  });

  if (userPoints) {
    await prisma.userPoints.update({
      where: { userId },
      data: {
        totalPoints: userPoints.totalPoints + pointsDiff,
      },
    });
  } else {
    await prisma.userPoints.create({
      data: {
        userId,
        totalPoints: points,
      },
    });
  }

  // Log points history for steps submission (only if points changed)
  if (pointsDiff !== 0) {
    await prisma.pointsHistory.create({
      data: {
        userId,
        points: Math.abs(pointsDiff),
        type: pointsDiff > 0 ? 'EARNED' : 'REFUND',
        source: 'Daily Steps',
        description: `${pointsDiff > 0 ? 'Earned' : 'Adjusted'} ${Math.abs(pointsDiff)} points for ${steps} steps`,
        metadata: {
          steps,
          date: stepDate,
          pointsCalculated: points,
        },
      },
    });
  }

  // Send notification for points earned (only if points > 0 and remainder preference is on)
  // Check user's notification preference once
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { remainder: true },
  });

  const canSendPushNotifications = Boolean(user?.remainder && isSubmittedForToday);

  if (pointsDiff > 0) {

    // if (user?.remainder) {
    //   try {
    //     await notificationServices.sendSingleNotification(
    //       userId,
    //       userId,
    //       {
    //         title: "Points Earned! 🎉",
    //         body: `Congratulations! You earned ${pointsDiff} points for your ${steps} steps today. Total points: ${(userPoints?.totalPoints || 0) + pointsDiff}`,
    //       }
    //     );
    //   } catch (error) {
    //     console.error("Failed to send points notification:", error);
    //   }
    // }
  }

  // Send daily milestone notifications (2000, 4000, 6000 steps = 1, 2, 3 miles)
  const dailyMilestones = [
    { steps: 2000, miles: 1, emoji: "🎯" },
    { steps: 4000, miles: 2, emoji: "🏃" },
    { steps: 6000, miles: 3, emoji: "🔥" },
  ];

  // Send notification for the highest milestone reached
  if (canSendPushNotifications) {
    // Find the highest milestone reached
    const highestMilestone = dailyMilestones
      .filter(m => steps >= m.steps && (!existingSteps || existingSteps.steps < m.steps))
      .sort((a, b) => b.steps - a.steps)[0];

    if (highestMilestone) {
      try {
        // Add 1-2 second delay before sending notification
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Determine message based on miles count
        const milestoneMessage = highestMilestone.miles === 1 ? 'Good' :
          highestMilestone.miles === 2 ? 'Better' : 'Best';

        console.log(`🎯 Sending ${highestMilestone.miles} mile notification to user ${userId}`);

        await notificationServices.sendSingleNotification(
          userId,
          userId,
          {
            title: `${highestMilestone.emoji} ${highestMilestone.miles} Mile${highestMilestone.miles > 1 ? 's' : ''} Complete!`,
            body: `${milestoneMessage}! You've completed ${highestMilestone.miles} mile${highestMilestone.miles > 1 ? 's' : ''} today with ${highestMilestone.steps.toLocaleString()} steps! Keep going!`,
            isMilesComplete: true,
            milesCount: highestMilestone.miles
          }
        );

        console.log(`✅ Successfully sent ${highestMilestone.miles} mile notification to user ${userId}`);
      } catch (error: any) {
        console.error(`❌ Failed to send ${highestMilestone.miles} mile notification to user ${userId}:`, {
          error: error.message,
          code: error.code,
          statusCode: error.statusCode,
          stack: error.stack
        });
      }
    }
  }

  // Check for streak milestones
  const allUserSteps = await prisma.steps.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  const currentStreakInfo = calculateStreak(allUserSteps);

  // Get all streak timers/milestones (sorted by days ascending)
  const streakMilestones = await prisma.streakTimer.findMany({
    orderBy: { days: 'asc' },
  });

  // Get user's unlocked milestones
  const unlockedMilestones = await prisma.unlockedStreakMilestone.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'desc' },
  });

  // Check if user just crossed the 2000 step threshold for the very first time today
  const justCrossedThreshold = steps >= 2000 && (!existingSteps || existingSteps.steps < 2000);

  // Update daysSinceUnlock for all unlocked milestones
  if (justCrossedThreshold) {
    for (const unlocked of unlockedMilestones) {
      // STRICT STREAK LOGIC: If their overall streak just restarted (meaning they missed yesterday),
      // we must reset their badge progress back to 0!
      const newDays = currentStreakInfo.currentStreak === 1 ? 0 : unlocked.daysSinceUnlock;

      await prisma.unlockedStreakMilestone.update({
        where: { id: unlocked.id },
        data: {
          daysSinceUnlock: newDays + 1,
        },
      });
    }
  }

  // Find the last unlocked milestone (highest days)
  const lastUnlockedMilestone = unlockedMilestones.length > 0
    ? streakMilestones.find(m => m.id === unlockedMilestones[0].streakTimerId)
    : null;

  // Get the most recently unlocked milestone record
  const lastUnlockedRecord = unlockedMilestones.length > 0 ? unlockedMilestones[0] : null;

  // Find next milestone to unlock (not yet unlocked and days > last unlocked)
  const unlockedMilestoneIds = unlockedMilestones.map(u => u.streakTimerId);
  const nextMilestone = streakMilestones.find(
    m => !unlockedMilestoneIds.includes(m.id) &&
      (!lastUnlockedMilestone || m.days > lastUnlockedMilestone.days)
  );

  // Check if user has achieved any milestones (can unlock multiple in one go)
  // This handles cases where user submits steps after long time
  let milestonesUnlocked = 0;

  while (true) {
    // Refresh unlocked milestones
    const currentUnlocked = await prisma.unlockedStreakMilestone.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' },
    });

    const currentUnlockedIds = currentUnlocked.map(u => u.streakTimerId);
    const lastUnlocked = currentUnlocked.length > 0 ? currentUnlocked[0] : null;
    const lastUnlockedMilestoneData = lastUnlocked
      ? streakMilestones.find(m => m.id === lastUnlocked.streakTimerId)
      : null;

    // Calculate progress
    // If they have unlocked a badge, use their DB daysSinceUnlock (which was already updated).
    // If they haven't unlocked a badge, use their actual currentStreak.
    const currentProgress = lastUnlocked
      ? lastUnlocked.daysSinceUnlock
      : currentStreakInfo.currentStreak;

    // Find next milestone
    const nextMilestoneToUnlock = streakMilestones.find(
      m => !currentUnlockedIds.includes(m.id) &&
        (!lastUnlockedMilestoneData || m.days > lastUnlockedMilestoneData.days) &&
        currentProgress >= m.days
    );

    if (!nextMilestoneToUnlock || steps < 2000) {
      break; // No more milestones to unlock
    }

    // Unlock this milestone
    await prisma.unlockedStreakMilestone.create({
      data: {
        userId,
        streakTimerId: nextMilestoneToUnlock.id,
        daysSinceUnlock: 0,
      },
    });

    // Award bonus points
    const updatedUserPoints = await prisma.userPoints.update({
      where: { userId },
      data: {
        totalPoints: {
          increment: nextMilestoneToUnlock.points,
        },
      },
    });

    // Log points history
    await prisma.pointsHistory.create({
      data: {
        userId,
        points: nextMilestoneToUnlock.points,
        type: 'BONUS',
        source: 'Streak Milestone',
        description: `${nextMilestoneToUnlock.title} - ${nextMilestoneToUnlock.days} days streak milestone unlocked`,
        metadata: {
          milestoneId: nextMilestoneToUnlock.id,
          streakDays: nextMilestoneToUnlock.days,
          milestoneTitle: nextMilestoneToUnlock.title,
          currentStreak: currentStreakInfo.currentStreak,
        },
      },
    });

    if (canSendPushNotifications) {
      try {
        // Add delay before milestone notification (more delay for subsequent milestones)
        await new Promise(resolve => setTimeout(resolve, 2000 + (milestonesUnlocked * 1000)));

        await notificationServices.sendSingleNotification(
          userId,
          userId,
          {
            title: `🏆 ${nextMilestoneToUnlock.title} Unlocked!`,
            body: `Congratulations! You've unlocked ${nextMilestoneToUnlock.title} and earned ${nextMilestoneToUnlock.points} bonus points! Your milestone counter has reset. Total points: ${updatedUserPoints.totalPoints}`,
          }
        );
      } catch (error) {
        console.error("Failed to send milestone notification:", error);
      }
    }

    milestonesUnlocked++;
  }

  return await translateObject(result, language);
};

// Calculate streak information
const calculateStreak = (stepsData: any[]) => {
  if (!stepsData || stepsData.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalDays: 0,
    };
  }

  // Filter only days with 2000+ steps (minimum for streak) - FOR TESTING
  const validStreakDays = stepsData.filter(step => step.steps >= 2000);

  if (validStreakDays.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalDays: 0,
    };
  }

  // Sort by date descending
  const sortedSteps = validStreakDays.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const currentStreak = calculateCurrentStepsStreak(stepsData);
  let bestStreak = 0;
  let tempStreak = 0;
  const totalDays = validStreakDays.length;

  // Helper function to get date string (YYYY-MM-DD) from Date object  
  const getDateString = (date: Date | string) => {
    const d = new Date(date);
    // Use UTC to avoid timezone issues
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate best streak
  for (let i = 0; i < sortedSteps.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const currentDateStr = getDateString(sortedSteps[i].date);
      const previousDateStr = getDateString(sortedSteps[i - 1].date);

      // Calculate day difference using date strings
      const currentMs = new Date(currentDateStr).getTime();
      const previousMs = new Date(previousDateStr).getTime();
      const dayDiff = Math.floor((previousMs - currentMs) / (1000 * 60 * 60 * 24));

      if (dayDiff === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }

    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
  }

  return {
    currentStreak,
    bestStreak,
    totalDays,
  };
};

const getCurrentMilestoneName = (
  userSteps: any[],
  streakTimers: any[],
  unlockedMilestones: any[]
) => {
  const streakInfo = calculateStreak(userSteps);
  const currentStreak = streakInfo.currentStreak;

  if (currentStreak <= 0) {
    return null;
  }

  const unlockedMilestoneIds = new Set(
    unlockedMilestones.map((milestone) => milestone.streakTimerId)
  );

  const unlockedMilestone = unlockedMilestones[0]
    ? streakTimers.find((timer) => timer.id === unlockedMilestones[0].streakTimerId)
    : null;

  if (unlockedMilestone) {
    return unlockedMilestone.title;
  }

  const currentMilestone = [...streakTimers]
    .reverse()
    .find((timer) => currentStreak >= timer.days);

  return currentMilestone?.title || null;
};

// Get last 30 days history with streak info
const getHistory = async (userId: string, language: SupportedLanguage = 'en') => {
  const todayUTCStart = getUTCStartOfDay(new Date());
  const thirtyDaysAgo = new Date(todayUTCStart);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  // Get all steps for streak calculation
  const allSteps = await prisma.steps.findMany({
    where: {
      userId,
    },
    orderBy: {
      date: 'desc',
    },
  });

  // Get last 30 days steps - group by date and get the latest entry for each date
  const last30DaysSteps = await prisma.steps.findMany({
    where: {
      userId,
      date: {
        gte: thirtyDaysAgo,
      },
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      steps: true,
      points: true,
      date: true,
      createdAt: true,
    },
  });

  // Group by date and keep only the latest entry for each day
  const groupedByDate = last30DaysSteps.reduce((acc: any, curr) => {
    const dateKey = curr.date.toISOString().split('T')[0];
    if (!acc[dateKey]) {
      acc[dateKey] = curr;
    }
    return acc;
  }, {});

  const historyData = Object.values(groupedByDate).sort(
    (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Get user's total points (from userPoints table, not from steps)
  const userPoints = await prisma.userPoints.findUnique({
    where: { userId },
  });

  // Calculate streak information
  const streakInfo = calculateStreak(allSteps);

  const response = {
    history: historyData,
    totalPoints: userPoints?.totalPoints || 0,
    streak: streakInfo,
  };

  return await translateObject(response, language);
};

// Get user's current total points
const getTotalPoints = async (userId: string, language: SupportedLanguage = 'en') => {
  const userPoints = await prisma.userPoints.findUnique({
    where: { userId },
  });

  return {
    totalPoints: userPoints?.totalPoints || 0,
  };
};

// Get only streak information
const getStreakInfo = async (userId: string, language: SupportedLanguage = 'en') => {
  // Get all steps for streak calculation
  const allSteps = await prisma.steps.findMany({
    where: {
      userId,
    },
    orderBy: {
      date: 'desc',
    },
  });

  // Calculate streak information
  const streakInfo = calculateStreak(allSteps);

  return streakInfo;
};

// Get points statistics for specified period (7, 30, 60, or 90 days)
const getPointsStatistics = async (userId: string, days: number, language: SupportedLanguage = 'en') => {
  if (![7, 30, 60, 90].includes(days)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Days must be 7, 30, 60, or 90");
  }

  // Ensure completed challenge rewards are distributed before statistics are generated.
  await challengeService.finalizeCompletedChallengesForUser(userId);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  // Get all steps records within the period with details
  const stepsInPeriod = await prisma.steps.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: 'desc',
    },
    select: {
      id: true,
      steps: true,
      points: true,
      date: true,
      createdAt: true,
    },
  });

  // Get points spent (voucher claims) from points history
  const spentPoints = await prisma.pointsHistory.findMany({
    where: {
      userId,
      type: 'SPENT',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get bonus points (streak achievements, etc.) from points history
  const bonusPoints = await prisma.pointsHistory.findMany({
    where: {
      userId,
      type: 'BONUS',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Group by date
  const dateWiseData: Record<string, any> = {};

  // Process steps (points gained)
  stepsInPeriod.forEach(step => {
    const dateKey = step.date.toISOString().split('T')[0];
    if (!dateWiseData[dateKey]) {
      dateWiseData[dateKey] = {
        date: step.date,
        gained: [],
        lost: [],
        totalSteps: 0, // Initialize total steps for the day
      };
    }

    // Add to total steps for the day
    dateWiseData[dateKey].totalSteps += step.steps;

    if (step.points > 0) {
      dateWiseData[dateKey].gained.push({
        source: 'Daily Steps',
        steps: step.steps,
        points: step.points,
        time: step.createdAt,
      });
    }
  });

  // Process bonus points (streak achievements, etc.)
  bonusPoints.forEach(bonus => {
    const dateKey = bonus.createdAt.toISOString().split('T')[0];
    if (!dateWiseData[dateKey]) {
      dateWiseData[dateKey] = {
        date: bonus.createdAt,
        gained: [],
        lost: [],
        totalSteps: 0, // Initialize total steps for the day
      };
    }

    dateWiseData[dateKey].gained.push({
      source: bonus.source,
      description: bonus.description,
      points: bonus.points,
      time: bonus.createdAt,
      metadata: bonus.metadata,
    });
  });

  // Process spent points (voucher claims)
  spentPoints.forEach(spent => {
    const dateKey = spent.createdAt.toISOString().split('T')[0];
    if (!dateWiseData[dateKey]) {
      dateWiseData[dateKey] = {
        date: spent.createdAt,
        gained: [],
        lost: [],
        totalSteps: 0, // Initialize total steps for the day
      };
    }

    dateWiseData[dateKey].lost.push({
      source: spent.source,
      description: spent.description,
      points: spent.points,
      time: spent.createdAt,
      metadata: spent.metadata,
    });
  });

  // Get current total points
  const userPoints = await prisma.userPoints.findUnique({
    where: { userId },
  });

  let runningTotal = userPoints?.totalPoints || 0;

  // Calculate running total for each date (reverse chronological order)
  const dailyBreakdown = Object.keys(dateWiseData)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map(dateKey => {
      const dayData = dateWiseData[dateKey];

      // Combine gained and lost, then sort by time to process in order
      const allTransactions = [
        ...dayData.gained.map((g: any) => ({ ...g, type: 'gained', time: g.time })),
        ...dayData.lost.map((l: any) => ({ ...l, type: 'lost', time: l.time }))
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // Process each transaction backwards in time and add totalPoints
      const gainedWithTotal: any[] = [];
      const lostWithTotal: any[] = [];

      allTransactions.forEach(transaction => {
        if (transaction.type === 'gained') {
          gainedWithTotal.push({
            source: transaction.source,
            steps: transaction.steps,
            description: transaction.description,
            points: transaction.points,
            time: transaction.time,
            metadata: transaction.metadata,
            totalPoints: runningTotal,
          });
          runningTotal -= transaction.points; // Going backwards
        } else {
          lostWithTotal.push({
            source: transaction.source,
            description: transaction.description,
            points: transaction.points,
            time: transaction.time,
            metadata: transaction.metadata,
            totalPoints: runningTotal,
          });
          runningTotal += transaction.points; // Going backwards
        }
      });

      return {
        date: dayData.date,
        totalSteps: dayData.totalSteps, // Add total steps for the day
        gained: gainedWithTotal,
        lost: lostWithTotal,
      };
    });

  // Calculate totals
  const totalPointsGained = dailyBreakdown.reduce(
    (sum, day) => sum + day.gained.reduce((s: number, g: any) => s + g.points, 0),
    0
  );
  const totalPointsLost = dailyBreakdown.reduce(
    (sum, day) => sum + day.lost.reduce((s: number, l: any) => s + l.points, 0),
    0
  );

  const netPoints = totalPointsGained - totalPointsLost;

  return {
    period: `${days} days`,
    summary: {
      pointsGained: totalPointsGained,
      pointsLost: totalPointsLost,
      netPoints,
      currentTotalPoints: userPoints?.totalPoints || 0,
    },
    dailyBreakdown,
  };
};

// Get all streak milestones with unlock status
const getStreakMilestones = async (userId: string, language: SupportedLanguage = 'en') => {
  // Get user's current streak
  const allSteps = await prisma.steps.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  const streakInfo = calculateStreak(allSteps);
  const currentStreak = streakInfo.currentStreak;

  // Get all streak milestones
  const milestones = await prisma.streakTimer.findMany({
    orderBy: { days: 'asc' },
  });

  // Get user's unlocked milestones
  const unlockedMilestones = await prisma.unlockedStreakMilestone.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'desc' },
  });

  const unlockedMilestoneIds = unlockedMilestones.map(u => u.streakTimerId);

  // Get the last unlocked milestone to calculate progress
  const lastUnlockedRecord = unlockedMilestones.length > 0 ? unlockedMilestones[0] : null;

  // If streak is broken (currentStreak = 0), reset progress to 0
  // If no milestones unlocked yet, progress is current streak
  // If milestones unlocked and streak active, progress is days since last unlock
  // Strict streak logic for frontend display
  let progressTowardNextMilestone;
  if (currentStreak === 0) {
    progressTowardNextMilestone = 0; // Reset when streak is broken
  } else if (lastUnlockedRecord) {
    progressTowardNextMilestone = lastUnlockedRecord.daysSinceUnlock;
  } else {
    progressTowardNextMilestone = currentStreak;
  }

  // Find next milestone to unlock
  const lastUnlockedMilestone = lastUnlockedRecord
    ? milestones.find(m => m.id === lastUnlockedRecord.streakTimerId)
    : null;

  const nextMilestone = milestones.find(
    m => !unlockedMilestoneIds.includes(m.id) &&
      (!lastUnlockedMilestone || m.days > lastUnlockedMilestone.days)
  );

  // Map milestones with unlock status
  const milestonesWithStatus = milestones.map(milestone => ({
    id: milestone.id,
    title: milestone.title,
    days: milestone.days,
    points: milestone.points,
    isUnlocked: unlockedMilestoneIds.includes(milestone.id),
    isCurrentTarget: nextMilestone?.id === milestone.id,
  }));

  const response = {
    currentStreak,
    daysSinceLastUnlock: progressTowardNextMilestone,
    lastUnlockedMilestone: lastUnlockedMilestone ? 
      lastUnlockedMilestone.title
    : null,
    nextMilestone: nextMilestone ? {
      id: nextMilestone.id,
      title: nextMilestone.title,
      days: nextMilestone.days,
      points: nextMilestone.points,
      daysRemaining: Math.max(0, nextMilestone.days - progressTowardNextMilestone),
      progress: progressTowardNextMilestone,
    } : null,
    milestones: milestonesWithStatus,
  };

  return await translateObject(response, language);
};

const getNetworkUserIds = async (userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      referredBy: true,
      referredUsers: {
        select: { id: true }
      },
      addedReferralCodes: {
        select: {
          referredUserId: true
        }
      },
      addedByUsers: {
        select: {
          userId: true
        }
      }
    },
  });

  if (!currentUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  const networkUserIds: string[] = [userId];

  if (currentUser.referredUsers && currentUser.referredUsers.length > 0) {
    networkUserIds.push(...currentUser.referredUsers.map(u => u.id));
  }

  if (currentUser.referredBy) {
    networkUserIds.push(currentUser.referredBy);
  }

  if (currentUser.addedReferralCodes && currentUser.addedReferralCodes.length > 0) {
    networkUserIds.push(...currentUser.addedReferralCodes.map(c => c.referredUserId));
  }

  if (currentUser.addedByUsers && currentUser.addedByUsers.length > 0) {
    networkUserIds.push(...currentUser.addedByUsers.map(c => c.userId));
  }

  return [...new Set(networkUserIds)];
};

// Get Leaderboard (Users with highest steps - only invited users network)
const getLeaderboard = async (userId: string, query: any, language: SupportedLanguage = 'en') => {
  const { page = 1, limit = 10, period = 'allTime' } = query; // period: 'allTime', 'weekly', 'today'
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const uniqueNetworkUserIds = await getNetworkUserIds(userId);

  let dateFilter: any = {};

  if (period === 'today') {
    // Show yesterday's data for 'today' period
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    dateFilter = { gte: yesterday, lte: yesterdayEnd };
  } else if (period === 'weekly') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    dateFilter = { gte: sevenDaysAgo };
  }

  // Get steps only for users in the referral network
  const whereClause: any = {
    userId: { in: uniqueNetworkUserIds }
  };

  if (Object.keys(dateFilter).length > 0) {
    whereClause.date = dateFilter;
  }

  // Get steps grouped by user
  const allSteps = await prisma.steps.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  // Group steps by user and calculate totals
  const userStepsMap = new Map<string, any>();
  const userStepsRecordsMap = new Map<string, any[]>();

  allSteps.forEach(step => {
    const stepUserId = step.userId;
    if (!userStepsMap.has(stepUserId)) {
      userStepsMap.set(stepUserId, {
        user: step.user,
        totalSteps: 0,
        totalPoints: 0,
        daysActive: 0,
        uniqueDates: new Set(),
      });
      userStepsRecordsMap.set(stepUserId, []);
    }

    const userStats = userStepsMap.get(stepUserId);
    const userRecords = userStepsRecordsMap.get(stepUserId) || [];
    userStats.totalSteps += step.steps;
    userStats.totalPoints += step.points;
    userStats.uniqueDates.add(step.date.toISOString().split('T')[0]);
    userRecords.push(step);
    userStepsRecordsMap.set(stepUserId, userRecords);
  });

  const streakTimers = await prisma.streakTimer.findMany({
    orderBy: { days: 'asc' },
  });

  const unlockedMilestones = await prisma.unlockedStreakMilestone.findMany({
    where: { userId: { in: uniqueNetworkUserIds } },
    orderBy: { unlockedAt: 'desc' },
  });

  const unlockedMilestonesByUser = new Map<string, any[]>();
  unlockedMilestones.forEach((milestone) => {
    const existing = unlockedMilestonesByUser.get(milestone.userId) || [];
    existing.push(milestone);
    unlockedMilestonesByUser.set(milestone.userId, existing);
  });

  // Convert to array and calculate additional stats
  const leaderboardData = Array.from(userStepsMap.entries()).map(([stepUserId, stats]) => {
    const totalMiles = (stats.totalSteps / 2000).toFixed(2); // 200 steps = 1 mile - FOR TESTING
    const averageStepsPerDay = stats.uniqueDates.size > 0
      ? Math.floor(stats.totalSteps / stats.uniqueDates.size)
      : 0;
    const lastUnlockedRecord = unlockedMilestonesByUser.get(stepUserId)?.[0];
    const lastUnlockedMilestone = lastUnlockedRecord
      ? streakTimers.find(milestone => milestone.id === lastUnlockedRecord.streakTimerId)
      : null;

    return {
      user: stats.user,
      totalSteps: stats.totalSteps,
      totalPoints: stats.totalPoints,
      totalMiles: parseFloat(totalMiles),
      daysActive: stats.uniqueDates.size,
      averageStepsPerDay,
      currentMilestone: getCurrentMilestoneName(
        userStepsRecordsMap.get(stepUserId) || [],
        streakTimers,
        unlockedMilestonesByUser.get(stepUserId) || []
      ),
      lastUnlockedMilestone: lastUnlockedMilestone ? 
         lastUnlockedMilestone.title
        : null,
      isCurrentUser: stepUserId === userId,
    };
  });

  // Sort by total steps (highest first)
  leaderboardData.sort((a, b) => b.totalSteps - a.totalSteps);

  // Add rank
  const rankedData = leaderboardData.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  // Paginate
  const paginatedData = rankedData.slice(skip, skip + take);
  const total = rankedData.length;

  const translatedData = await translateArray(paginatedData, language);

  return {
    data: translatedData,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      networkSize: uniqueNetworkUserIds.length,
    },
    period,
  };
};

// Get Leaderboard (Include all network users, even with zero steps)
const getAllFriendsLeaderboard = async (userId: string, query: any, language: SupportedLanguage = 'en') => {
  const { page = 1, limit = 10, period = 'allTime' } = query; // period: 'allTime', 'weekly', 'today'
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const uniqueNetworkUserIds = await getNetworkUserIds(userId);

  let dateFilter: any = {};

  if (period === 'today') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    dateFilter = { gte: yesterday, lte: yesterdayEnd };
  } else if (period === 'weekly') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    dateFilter = { gte: sevenDaysAgo };
  }

  const whereClause: any = {
    userId: { in: uniqueNetworkUserIds }
  };

  if (Object.keys(dateFilter).length > 0) {
    whereClause.date = dateFilter;
  }

  const allSteps = await prisma.steps.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  const networkUsers = await prisma.user.findMany({
    where: {
      id: { in: uniqueNetworkUserIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  const userStepsMap = new Map<string, any>();
  const userStepsRecordsMap = new Map<string, any[]>();

  allSteps.forEach(step => {
    const stepUserId = step.userId;
    if (!userStepsMap.has(stepUserId)) {
      userStepsMap.set(stepUserId, {
        user: step.user,
        totalSteps: 0,
        totalPoints: 0,
        daysActive: 0,
        uniqueDates: new Set(),
      });
      userStepsRecordsMap.set(stepUserId, []);
    }

    const userStats = userStepsMap.get(stepUserId);
    const userRecords = userStepsRecordsMap.get(stepUserId) || [];
    userStats.totalSteps += step.steps;
    userStats.totalPoints += step.points;
    userStats.uniqueDates.add(step.date.toISOString().split('T')[0]);
    userRecords.push(step);
    userStepsRecordsMap.set(stepUserId, userRecords);
  });

  const streakTimers = await prisma.streakTimer.findMany({
    orderBy: { days: 'asc' },
  });

  const unlockedMilestones = await prisma.unlockedStreakMilestone.findMany({
    where: { userId: { in: uniqueNetworkUserIds } },
    orderBy: { unlockedAt: 'desc' },
  });

  const unlockedMilestonesByUser = new Map<string, any[]>();
  unlockedMilestones.forEach((milestone) => {
    const existing = unlockedMilestonesByUser.get(milestone.userId) || [];
    existing.push(milestone);
    unlockedMilestonesByUser.set(milestone.userId, existing);
  });

  const leaderboardData = networkUsers.map((networkUser) => {
    const stats = userStepsMap.get(networkUser.id);
    const totalSteps = stats?.totalSteps || 0;
    const totalPoints = stats?.totalPoints || 0;
    const daysActive = stats?.uniqueDates?.size || 0;
    const totalMiles = (totalSteps / 2000).toFixed(2); // 200 steps = 1 mile - FOR TESTING
    const averageStepsPerDay = daysActive > 0 ? Math.floor(totalSteps / daysActive) : 0;

    return {
      user: stats?.user || networkUser,
      totalSteps,
      totalPoints,
      totalMiles: parseFloat(totalMiles),
      daysActive,
      averageStepsPerDay,
      currentMilestone: getCurrentMilestoneName(
        userStepsRecordsMap.get(networkUser.id) || [],
        streakTimers,
        unlockedMilestonesByUser.get(networkUser.id) || []
      ),
      isCurrentUser: networkUser.id === userId,
    };
  });

  leaderboardData.sort((a, b) => b.totalSteps - a.totalSteps);

  const rankedData = leaderboardData.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  const paginatedData = rankedData.slice(skip, skip + take);
  const total = rankedData.length;

  const translatedData = await translateArray(paginatedData, language);

  return {
    data: translatedData,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      networkSize: uniqueNetworkUserIds.length,
    },
    period,
  };
};

export const stepsService = {
  submitSteps,
  getHistory,
  getTotalPoints,
  getStreakInfo,
  getPointsStatistics,
  getStreakMilestones,
  getLeaderboard,
  getAllFriendsLeaderboard,
};
