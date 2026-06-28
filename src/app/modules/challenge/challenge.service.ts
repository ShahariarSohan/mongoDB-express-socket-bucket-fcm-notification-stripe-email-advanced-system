import {
  Challenge,
  ChallengeInvitationStatus,
  ChallengeParticipant,
  ChallengeParticipantStatus,
} from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../../utils/prisma";
import ApiError from "../../error/ApiErrors";
import { notificationServices } from "../notifications/notification.service";

const MAX_CHALLENGE_PARTICIPANTS = 15;
const STEP_TO_DM_DIVISOR = 100; // 2000 steps = 20 DM
const DAY_MS = 24 * 60 * 60 * 1000;
const calculateRawPointsFromSteps = (steps: number) => steps / STEP_TO_DM_DIVISOR;
const calculatePointsFromSteps = (steps: number) => Math.floor(steps / STEP_TO_DM_DIVISOR);

type ParticipantSummary = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  todayMiles: number;
  totalSteps: number;
  totalMiles: number;
  pointsFromSteps: number;
  lastUnlockedMilestone: string | null;
  rewardPoints: number;
};

const getUTCStartOfDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const getUTCEndOfDay = (date: Date): Date => {
  const dayStart = getUTCStartOfDay(date);
  return new Date(dayStart.getTime() + DAY_MS - 1);
};

const toTwoDecimals = (value: number) => Number(value.toFixed(2));

const getDisplayName = (user: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) => {
  if (user.name) return user.name;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  return user.email;
};

const parseFutureStartDate = (startDate: string): Date => {
  const parsed = new Date(startDate);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid startDate format");
  }

  if (parsed.getTime() <= Date.now()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Challenge startDate must be in the future");
  }

  return parsed;
};

const getChallengeDaysMeta = (
  startDate: Date,
  endDate: Date,
  participantCount: number,
  now = new Date()
) => {
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS));

  if (now < startDate) {
    return {
      totalDays,
      daysCompleted: 0,
      daysLeft: totalDays,
      phase: "UPCOMING",
    };
  }

  if (participantCount < 3) {
    return {
      totalDays,
      daysCompleted: 0,
      daysLeft: 0,
      phase: "CANCELLED",
    };
  }

  if (now > endDate) {
    return {
      totalDays,
      daysCompleted: totalDays,
      daysLeft: 0,
      phase: "COMPLETED",
    };
  }

  const daysCompleted = Math.min(totalDays, Math.floor((now.getTime() - startDate.getTime()) / DAY_MS) + 1);

  return {
    totalDays,
    daysCompleted,
    daysLeft: Math.max(0, totalDays - daysCompleted),
    phase: "ONGOING",
  };
};

const ensureNoChallengeOverlap = async (
  userId: string,
  startDate: Date,
  endDate: Date,
  actionLabel = "join",
  excludeChallengeId?: string
) => {
  const whereClause: any = {
    userId,
    status: ChallengeParticipantStatus.ACCEPTED,
    challenge: {
      startDate: {
        lt: endDate,
      },
      endDate: {
        gt: startDate,
      },
    },
  };

  if (excludeChallengeId) {
    whereClause.challengeId = {
      not: excludeChallengeId,
    };
  }

  const overlapping = await prisma.challengeParticipant.findFirst({
    where: whereClause,
    include: {
      challenge: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  if (overlapping) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot ${actionLabel} this challenge. You have another challenge starting on ${overlapping.challenge.startDate.toISOString()} which will overlap with this challenge.`
    );
  }

  const invitationWhere: any = {
    inviteeId: userId,
    status: ChallengeInvitationStatus.PENDING,
    challenge: {
      startDate: {
        lt: endDate,
      },
      endDate: {
        gt: startDate,
      },
    },
  };

  if (excludeChallengeId) {
    invitationWhere.challengeId = {
      not: excludeChallengeId,
    };
  }

  const pendingInvitation = await prisma.challengeInvitation.findFirst({
    where: invitationWhere,
    include: {
      challenge: {
        select: {
          startDate: true,
        },
      },
    },
  });

  if (pendingInvitation) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot ${actionLabel} this challenge. You have a pending challenge invitation starting on ${pendingInvitation.challenge.startDate.toISOString()} which will overlap with this challenge.`
    );
  }
};

const buildChallengeAnalytics = async (challengeId: string, viewerUserId: string) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: {
        where: { status: ChallengeParticipantStatus.ACCEPTED },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  });

  if (!challenge) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Challenge not found");
  }

  const now = new Date();
  const userIds = challenge.participants.map((participant) => participant.userId);

  let periodSteps: Array<{ userId: string; steps: number }> = [];
  if (now >= challenge.startDate) {
    const periodEnd = now < challenge.endDate ? now : challenge.endDate;
    periodSteps = await prisma.steps.findMany({
      where: {
        userId: { in: userIds },
        date: {
          gte: challenge.startDate,
          lte: periodEnd,
        },
      },
      select: {
        userId: true,
        steps: true,
      },
    });
  }

  const todayStart = getUTCStartOfDay(now);
  const todayEnd = getUTCEndOfDay(now);
  const todayLowerBound = challenge.startDate > todayStart ? challenge.startDate : todayStart;
  const todayUpperBound = challenge.endDate < todayEnd ? challenge.endDate : todayEnd;

  let todaySteps: Array<{ userId: string; steps: number }> = [];
  if (todayLowerBound <= todayUpperBound) {
    todaySteps = await prisma.steps.findMany({
      where: {
        userId: { in: userIds },
        date: {
          gte: todayLowerBound,
          lte: todayUpperBound,
        },
      },
      select: {
        userId: true,
        steps: true,
      },
    });
  }

  const totalStepsByUser = new Map<string, number>();
  for (const stepEntry of periodSteps) {
    totalStepsByUser.set(stepEntry.userId, (totalStepsByUser.get(stepEntry.userId) || 0) + stepEntry.steps);
  }

  const todayStepsByUser = new Map<string, number>();
  for (const stepEntry of todaySteps) {
    todayStepsByUser.set(stepEntry.userId, (todayStepsByUser.get(stepEntry.userId) || 0) + stepEntry.steps);
  }

  const latestUnlockedByUser = new Map<string, string>();
  const unlockedMilestones = await prisma.unlockedStreakMilestone.findMany({
    where: {
      userId: { in: userIds },
    },
    orderBy: {
      unlockedAt: "desc",
    },
    select: {
      userId: true,
      streakTimerId: true,
    },
  });

  const streakTimerIds: string[] = [];
  for (const unlocked of unlockedMilestones) {
    if (!latestUnlockedByUser.has(unlocked.userId)) {
      latestUnlockedByUser.set(unlocked.userId, unlocked.streakTimerId);
      streakTimerIds.push(unlocked.streakTimerId);
    }
  }

  const streakTimers = streakTimerIds.length
    ? await prisma.streakTimer.findMany({
      where: {
        id: { in: [...new Set(streakTimerIds)] },
      },
      select: {
        id: true,
        title: true,
      },
    })
    : [];

  const streakTitleMap = new Map(streakTimers.map((streakTimer) => [streakTimer.id, streakTimer.title]));

  let participants: ParticipantSummary[] = challenge.participants
    .map((participant) => {
      const totalSteps = totalStepsByUser.get(participant.userId) || 0;
      const todayStepsValue = todayStepsByUser.get(participant.userId) || 0;
      const lastUnlockedStreakTimerId = latestUnlockedByUser.get(participant.userId);

      return {
        rank: 0,
        userId: participant.userId,
        name: getDisplayName(participant.user),
        image: participant.user.image,
        todayMiles: toTwoDecimals(todayStepsValue / 2000),
        totalSteps,
        totalMiles: toTwoDecimals(totalSteps / 2000),
        pointsFromSteps: calculatePointsFromSteps(totalSteps),
        lastUnlockedMilestone: lastUnlockedStreakTimerId
          ? streakTitleMap.get(lastUnlockedStreakTimerId) || null
          : null,
        rewardPoints: participant.rewardPoints,
      };
    })
    .sort((a, b) => {
      if (b.totalSteps === a.totalSteps) {
        return a.name.localeCompare(b.name);
      }
      return b.totalSteps - a.totalSteps;
    })
    .map((participant, index) => ({
      ...participant,
      rank: index + 1,
    }));

  const myParticipant = participants.find((participant) => participant.userId === viewerUserId);
  const totalParticipantSteps = participants.reduce((sum, participant) => sum + participant.totalSteps, 0);
  const totalParticipantPointsFromSteps = Math.floor(calculateRawPointsFromSteps(totalParticipantSteps));
  const rewardPerParticipant = Math.floor(calculateRawPointsFromSteps(totalParticipantSteps) / challenge.participants.length);
  const daysMeta = getChallengeDaysMeta(challenge.startDate, challenge.endDate, challenge.participants.length, now);

  // Ensure reported reward points match computed per-participant reward
  participants = participants.map((p) => ({ ...p, rewardPoints: rewardPerParticipant }));

  return {
    challenge,
    participants,
    myRank: myParticipant?.rank || null,
    myPoints: myParticipant?.pointsFromSteps || 0,
    myRewardPoints: myParticipant ? rewardPerParticipant : 0,
    top3Participants: participants.slice(0, 3),
    totalParticipantSteps,
    totalParticipantPointsFromSteps,
    rewardPerParticipant,
    daysMeta,
  };
};

const finalizeCompletedChallengesForUser = async (userId?: string) => {
  const now = new Date();
  const whereClause: any = {
    rewardsDistributed: false,
    startDate: {
      lte: now,
    },
  };

  if (userId) {
    whereClause.participants = {
      some: {
        userId,
        status: ChallengeParticipantStatus.ACCEPTED,
      },
    };
  }

  const candidates = await prisma.challenge.findMany({
    where: whereClause,
    include: {
      participants: {
        where: {
          status: ChallengeParticipantStatus.ACCEPTED,
        },
      },
    },
  });

  for (const challenge of candidates) {
    if (challenge.participants.length < 3) {
      const claim = await prisma.challenge.updateMany({
        where: {
          id: challenge.id,
          rewardsDistributed: false,
        },
        data: {
          rewardsDistributed: true,
          totalRewardPoints: 0,
          rewardPointsPerParticipant: 0,
        },
      });

      if (!claim.count) {
        continue;
      }

      for (const participant of challenge.participants) {
        try {
          await notificationServices.sendSingleNotification(participant.userId, participant.userId, {
            title: "Challenge Cancelled",
            body: `Challenge "${challenge.name}" was cancelled because it did not meet the minimum requirement of 3 participants.`,
          });
        } catch (error) {
          console.error("Failed to send challenge cancellation notification", error);
        }
      }
      continue;
    }

    if (challenge.endDate >= now) {
      continue;
    }

    const participantIds = challenge.participants.map((participant) => participant.userId);
    const challengeSteps = await prisma.steps.findMany({
      where: {
        userId: { in: participantIds },
        date: {
          gte: challenge.startDate,
          lte: challenge.endDate,
        },
      },
      select: {
        steps: true,
      },
    });

    const totalSteps = challengeSteps.reduce((sum, stepEntry) => sum + stepEntry.steps, 0);
    const rawTotalRewardPoints = calculateRawPointsFromSteps(totalSteps);
    const totalRewardPoints = Math.floor(rawTotalRewardPoints);
    const rewardPerParticipant = Math.floor(rawTotalRewardPoints / challenge.participants.length);

    const claim = await prisma.challenge.updateMany({
      where: {
        id: challenge.id,
        rewardsDistributed: false,
      },
      data: {
        rewardsDistributed: true,
        totalRewardPoints,
        rewardPointsPerParticipant: rewardPerParticipant,
      },
    });

    if (!claim.count) {
      continue;
    }

    for (const participant of challenge.participants) {
      await prisma.challengeParticipant.update({
        where: {
          challengeId_userId: {
            challengeId: challenge.id,
            userId: participant.userId,
          },
        },
        data: {
          rewardPoints: rewardPerParticipant,
        },
      });

      if (rewardPerParticipant > 0) {
        await prisma.userPoints.upsert({
          where: {
            userId: participant.userId,
          },
          update: {
            totalPoints: {
              increment: rewardPerParticipant,
            },
          },
          create: {
            userId: participant.userId,
            totalPoints: rewardPerParticipant,
          },
        });

        await prisma.pointsHistory.create({
          data: {
            userId: participant.userId,
            points: rewardPerParticipant,
            type: "BONUS",
            source: "Challenge Reward",
            description: `Reward from challenge ${challenge.name}`,
            metadata: {
              challengeId: challenge.id,
              challengeName: challenge.name,
              totalChallengeSteps: totalSteps,
              rewardPerParticipant,
            },
          },
        });
      }

      const notificationBody =
        rewardPerParticipant > 0
          ? `Challenge \"${challenge.name}\" completed. You earned ${rewardPerParticipant} DM points.`
          : `Challenge \"${challenge.name}\" completed.`;

      try {
        await notificationServices.sendSingleNotification(participant.userId, participant.userId, {
          title: "Challenge Completed",
          body: notificationBody,
        });
      } catch (error) {
        console.error("Failed to send challenge completion notification", error);
      }
    }
  }
};

const createChallenge = async (
  userId: string,
  payload: {
    name: string;
    description?: string;
    category: Challenge["category"];
    durationWeeks: number;
    startDate: string;
    inviteeUserIds?: string[];
  }
) => {
  await finalizeCompletedChallengesForUser(userId);

  const startDate = parseFutureStartDate(payload.startDate);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + payload.durationWeeks * 7);

  await ensureNoChallengeOverlap(userId, startDate, endDate, "create");

  const challenge = await prisma.challenge.create({
    data: {
      name: payload.name,
      description: payload.description,
      category: payload.category,
      durationWeeks: payload.durationWeeks,
      startDate,
      endDate,
      maxParticipants: MAX_CHALLENGE_PARTICIPANTS,
      createdBy: userId,
      participants: {
        create: {
          userId,
          status: ChallengeParticipantStatus.ACCEPTED,
        },
      },
    },
  });

  const inviteeUserIds = [...new Set((payload.inviteeUserIds || []).filter((inviteeUserId) => inviteeUserId !== userId))];

  let invitations = {
    invitedCount: 0,
    skippedCount: 0,
  };

  if (inviteeUserIds.length > 0) {
    const invitationResult = await inviteUsersToChallenge(challenge.id, userId, inviteeUserIds);
    invitations = {
      invitedCount: invitationResult.invitedCount,
      skippedCount: invitationResult.skippedCount,
    };
  }

  return {
    ...challenge,
    invitations,
  };
};

const inviteUsersToChallenge = async (challengeId: string, inviterId: string, userIds: string[]) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: {
        where: {
          status: ChallengeParticipantStatus.ACCEPTED,
        },
        select: {
          userId: true,
        },
      },
    },
  });

  if (!challenge) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Challenge not found");
  }

  if (new Date() >= challenge.startDate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Challenge has already started. You can no longer invite users.");
  }

  const isInviterParticipant = challenge.participants.some((participant) => participant.userId === inviterId);
  if (!isInviterParticipant) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Only challenge participants can invite others");
  }

  const uniqueUserIds = [...new Set(userIds)].filter((inviteeUserId) => inviteeUserId !== inviterId);
  if (!uniqueUserIds.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "No valid user IDs provided for invitation");
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: uniqueUserIds },
    },
    select: {
      id: true,
    },
  });

  if (users.length !== uniqueUserIds.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Some invited user IDs are invalid");
  }

  const participantUserIds = new Set(challenge.participants.map((participant) => participant.userId));

  let invitedCount = 0;
  let skippedCount = 0;

  for (const inviteeUserId of uniqueUserIds) {
    if (participantUserIds.has(inviteeUserId)) {
      skippedCount += 1;
      continue;
    }

    await prisma.challengeInvitation.upsert({
      where: {
        challengeId_inviteeId: {
          challengeId,
          inviteeId: inviteeUserId,
        },
      },
      update: {
        inviterId,
        status: ChallengeInvitationStatus.PENDING,
        acceptedAt: null,
      },
      create: {
        challengeId,
        inviterId,
        inviteeId: inviteeUserId,
        status: ChallengeInvitationStatus.PENDING,
      },
    });

    invitedCount += 1;

    try {
      await notificationServices.sendSingleNotification(inviterId, inviteeUserId, {
        title: "Challenge Invitation",
        body: `You have been invited to join challenge \"${challenge.name}\"`,
      });
    } catch (error) {
      console.error("Failed to send challenge invitation notification", error);
    }
  }

  return {
    challengeId,
    invitedCount,
    skippedCount,
  };
};

const acceptChallengeInvitation = async (invitationId: string, userId: string) => {
  await finalizeCompletedChallengesForUser(userId);

  const invitation = await prisma.challengeInvitation.findUnique({
    where: { id: invitationId },
    include: {
      challenge: {
        include: {
          participants: {
            where: {
              status: ChallengeParticipantStatus.ACCEPTED,
            },
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!invitation) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Invitation not found");
  }

  if (invitation.inviteeId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, "You are not allowed to accept this invitation");
  }

  if (invitation.status === ChallengeInvitationStatus.ACCEPTED) {
    return {
      challengeId: invitation.challengeId,
      status: invitation.status,
      message: "Invitation already accepted",
    };
  }

  if (invitation.status === ChallengeInvitationStatus.DECLINED) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "This invitation has been declined already");
  }

  if (new Date() >= invitation.challenge.startDate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Challenge has already started. You can no longer join.");
  }

  if (invitation.challenge.participants.length >= invitation.challenge.maxParticipants) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Challenge participant limit reached");
  }

  await ensureNoChallengeOverlap(
    userId,
    invitation.challenge.startDate,
    invitation.challenge.endDate,
    "join",
    invitation.challengeId
  );

  const isAlreadyParticipant = invitation.challenge.participants.some((participant) => participant.userId === userId);
  if (!isAlreadyParticipant) {
    await prisma.challengeParticipant.create({
      data: {
        challengeId: invitation.challengeId,
        userId,
        status: ChallengeParticipantStatus.ACCEPTED,
      },
    });
  }

  const updatedInvitation = await prisma.challengeInvitation.update({
    where: { id: invitationId },
    data: {
      status: ChallengeInvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });

  try {
    await notificationServices.sendSingleNotification(userId, invitation.inviterId, {
      title: "Challenge Invitation Accepted",
      body: "Your challenge invitation was accepted",
    });
  } catch (error) {
    console.error("Failed to send invitation acceptance notification", error);
  }

  return updatedInvitation;
};

const leaveChallenge = async (challengeId: string, userId: string) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: {
        where: {
          userId,
          status: ChallengeParticipantStatus.ACCEPTED,
        },
        select: {
          userId: true,
        },
      },
    },
  });

  if (!challenge) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Challenge not found");
  }

  if (new Date() > challenge.endDate) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Cannot leave a completed or ended challenge");
  }

  if (!challenge.participants.length) {
    throw new ApiError(StatusCodes.FORBIDDEN, "You are not a participant of this challenge");
  }

  await prisma.challengeParticipant.delete({
    where: {
      challengeId_userId: {
        challengeId,
        userId,
      },
    },
  });

  return {
    challengeId,
    userId,
    leftAt: new Date(),
  };
};

const deleteChallenge = async (challengeId: string, userId: string) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: {
        select: {
          userId: true,
        },
      },
      invitations: {
        select: {
          inviteeId: true,
        },
      },
    },
  });

  if (!challenge) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Challenge not found");
  }

  if (challenge.createdBy !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Only the challenge creator can delete this challenge");
  }

  if (new Date() >= challenge.startDate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Cannot delete a challenge that has already started");
  }

  const recipientIds = new Set<string>();
  for (const participant of challenge.participants) {
    if (participant.userId !== userId) {
      recipientIds.add(participant.userId);
    }
  }

  for (const invitation of challenge.invitations) {
    if (invitation.inviteeId !== userId) {
      recipientIds.add(invitation.inviteeId);
    }
  }

  await prisma.challenge.delete({
    where: { id: challengeId },
  });

  for (const recipientId of recipientIds) {
    try {
      await notificationServices.sendSingleNotification(userId, recipientId, {
        title: "Challenge Deleted",
        body: `The challenge \"${challenge.name}\" has been deleted.`,
      });
    } catch (error) {
      console.error("Failed to send challenge deletion notification", error);
    }
  }

  return {
    id: challengeId,
    name: challenge.name,
  };
};

const getSingleChallenge = async (challengeId: string, userId: string) => {
  await finalizeCompletedChallengesForUser(userId);

  const analytics = await buildChallengeAnalytics(challengeId, userId);

  return {
    id: analytics.challenge.id,
    name: analytics.challenge.name,
    description: analytics.challenge.description,
    category: analytics.challenge.category,
    durationWeeks: analytics.challenge.durationWeeks,
    startDate: analytics.challenge.startDate,
    endDate: analytics.challenge.endDate,
    maxParticipants: analytics.challenge.maxParticipants,
    totalParticipants: analytics.participants.length,
    totalParticipantSteps: analytics.totalParticipantSteps,
    totalParticipantPointsFromSteps: analytics.totalParticipantPointsFromSteps,
    rewardPointsPerParticipant: analytics.rewardPerParticipant,
    myRank: analytics.myRank,
    myPoints: analytics.myPoints,
    myRewardPoints: analytics.myRewardPoints,
    daysCompleted: analytics.daysMeta.daysCompleted,
    daysLeft: analytics.daysMeta.daysLeft,
    phase: analytics.daysMeta.phase,
    participants: analytics.participants,
  };
};

const getMyOngoingChallenges = async (userId: string) => {
  await finalizeCompletedChallengesForUser(userId);

  const memberships = await prisma.challengeParticipant.findMany({
    where: {
      userId,
      status: ChallengeParticipantStatus.ACCEPTED,
      challenge: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    },
    select: {
      challengeId: true,
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  const challenges = await Promise.all(
    memberships.map(async (membership) => {
      const analytics = await buildChallengeAnalytics(membership.challengeId, userId);

      return {
        id: analytics.challenge.id,
        name: analytics.challenge.name,
        category: analytics.challenge.category,
        startDate: analytics.challenge.startDate,
        endDate: analytics.challenge.endDate,
        myRank: analytics.myRank,
        myPoints: analytics.myPoints,
        daysLeft: analytics.daysMeta.daysLeft,
        daysCompleted: analytics.daysMeta.daysCompleted,
        top3Participants: analytics.top3Participants,
        phase: analytics.daysMeta.phase,
      };
    })
  );

  return challenges.filter((c) => c.phase === "ONGOING");
};

const getMyCompletedChallenges = async (userId: string) => {
  await finalizeCompletedChallengesForUser(userId);

  const memberships = await prisma.challengeParticipant.findMany({
    where: {
      userId,
      status: ChallengeParticipantStatus.ACCEPTED,
      challenge: {
        endDate: { lt: new Date() },
      },
    },
    select: {
      challengeId: true,
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  const challenges = await Promise.all(
    memberships.map(async (membership) => {
      const analytics = await buildChallengeAnalytics(membership.challengeId, userId);

      return {
        id: analytics.challenge.id,
        name: analytics.challenge.name,
        category: analytics.challenge.category,
        startDate: analytics.challenge.startDate,
        endDate: analytics.challenge.endDate,
        myRank: analytics.myRank,
        myPoints: analytics.myPoints,
        myRewardPoints: analytics.myRewardPoints,
        daysLeft: analytics.daysMeta.daysLeft,
        daysCompleted: analytics.daysMeta.daysCompleted,
        top3Participants: analytics.top3Participants,
        phase: analytics.daysMeta.phase,
      };
    })
  );

  return challenges.filter((c) => c.phase === "COMPLETED");
};

const getMyUpcomingChallenges = async (userId: string) => {
  await finalizeCompletedChallengesForUser(userId);

  const memberships = await prisma.challengeParticipant.findMany({
    where: {
      userId,
      status: ChallengeParticipantStatus.ACCEPTED,
      challenge: {
        startDate: { gt: new Date() },
      },
    },
    select: {
      challengeId: true,
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  const challenges = await Promise.all(
    memberships.map(async (membership) => {
      const analytics = await buildChallengeAnalytics(membership.challengeId, userId);

      return {
        id: analytics.challenge.id,
        name: analytics.challenge.name,
        category: analytics.challenge.category,
        startDate: analytics.challenge.startDate,
        endDate: analytics.challenge.endDate,
        totalParticipants: analytics.participants.length,
        daysLeft: analytics.daysMeta.daysLeft,
        daysCompleted: analytics.daysMeta.daysCompleted,
        top3Participants: analytics.top3Participants,
        phase: analytics.daysMeta.phase,
      };
    })
  );

  return challenges.filter((c) => c.phase === "UPCOMING");
};

const getMyCancelledChallenges = async (userId: string) => {
  await finalizeCompletedChallengesForUser(userId);

  const memberships = await prisma.challengeParticipant.findMany({
    where: {
      userId,
      status: ChallengeParticipantStatus.ACCEPTED,
      challenge: {
        startDate: { lte: new Date() },
      },
    },
    select: {
      challengeId: true,
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  const challenges = await Promise.all(
    memberships.map(async (membership) => {
      const analytics = await buildChallengeAnalytics(membership.challengeId, userId);

      return {
        id: analytics.challenge.id,
        name: analytics.challenge.name,
        category: analytics.challenge.category,
        startDate: analytics.challenge.startDate,
        endDate: analytics.challenge.endDate,
        myRank: analytics.myRank,
        myPoints: analytics.myPoints,
        daysLeft: analytics.daysMeta.daysLeft,
        daysCompleted: analytics.daysMeta.daysCompleted,
        top3Participants: analytics.top3Participants,
        phase: analytics.daysMeta.phase,
      };
    })
  );

  return challenges.filter((c) => c.phase === "CANCELLED");
};

const getMyInvitations = async (userId: string) => {
  await finalizeCompletedChallengesForUser(userId);

  const invitations = await prisma.challengeInvitation.findMany({
    where: {
      inviteeId: userId,
      status: ChallengeInvitationStatus.PENDING,
      challenge: {
        startDate: {
          gt: new Date(),
        },
      },
    },
    include: {
      inviter: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          image: true,
        },
      },
      challenge: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return Promise.all(
    invitations.map(async (invitation) => {
      const analytics = await buildChallengeAnalytics(invitation.challenge.id, userId);

      return {
        invitationId: invitation.id,
        invitedAt: invitation.createdAt,
        invitedBy: {
          id: invitation.inviter.id,
          name: getDisplayName(invitation.inviter),
          image: invitation.inviter.image,
        },
        challenge: {
          id: analytics.challenge.id,
          name: analytics.challenge.name,
          category: analytics.challenge.category,
          startDate: analytics.challenge.startDate,
          endDate: analytics.challenge.endDate,
          myRank: null,
          myPoints: 0,
          daysLeft: analytics.daysMeta.daysLeft,
          daysCompleted: analytics.daysMeta.daysCompleted,
          top3Participants: analytics.top3Participants,
        },
      };
    })
  );
};

export const challengeService = {
  createChallenge,
  inviteUsersToChallenge,
  acceptChallengeInvitation,
  leaveChallenge,
  deleteChallenge,
  getSingleChallenge,
  getMyOngoingChallenges,
  getMyCompletedChallenges,
  getMyUpcomingChallenges,
  getMyCancelledChallenges,
  getMyInvitations,
  finalizeCompletedChallengesForUser,
};
