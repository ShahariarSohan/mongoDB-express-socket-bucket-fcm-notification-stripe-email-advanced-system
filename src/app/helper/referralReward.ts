export interface ReferralRewardInput {
  userId: string;
  points: number;
  source: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export const grantReferralRewards = async (client: any, rewards: ReferralRewardInput[]) => {
  const uniqueRewards = rewards.filter((reward, index, self) =>
    index === self.findIndex(item => item.userId === reward.userId && item.source === reward.source)
  );

  for (const reward of uniqueRewards) {
    if (reward.points <= 0) {
      continue;
    }

    await client.userPoints.upsert({
      where: { userId: reward.userId },
      update: {
        totalPoints: {
          increment: reward.points,
        },
      },
      create: {
        userId: reward.userId,
        totalPoints: reward.points,
      },
    });

    await client.pointsHistory.create({
      data: {
        userId: reward.userId,
        points: reward.points,
        type: "BONUS",
        source: reward.source,
        description: reward.description,
        metadata: reward.metadata || undefined,
      },
    });
  }
};