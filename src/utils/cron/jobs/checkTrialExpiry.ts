import { PrismaClient } from "@prisma/client";
import { notificationServices } from "../../../app/modules/notifications/notification.service";

const prisma = new PrismaClient();

/**
 * Check for shops whose 60-day trial expires in exactly 3 days
 * Runs every day at midnight
 */
export const checkTrialExpiry = async () => {
  try {
    const now = new Date();

    const expiredTrialResult = await prisma.shop.updateMany({
      where: {
        freeSubscriptionExpiresAt: {
          lt: now,
        },
        isTrialActive: true,
        hasActiveSubscription: false,
      },
      data: {
        isTrialActive: false,
        subscriptionStatus: "Expired",
      },
    });

    console.log(`Marked ${expiredTrialResult.count} shop trials as expired.`);
    
    // Find shops where freeSubscriptionExpiresAt is between 3 and 4 days from now
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

    const expiringShops = await prisma.shop.findMany({
      where: {
        freeSubscriptionExpiresAt: {
          gte: threeDaysFromNow,
          lt: fourDaysFromNow,
        },
        shopStatus: 'APPROVED',
      },
      include: {
        user: true,
      },
    });

    console.log(`Found ${expiringShops.length} shops with trials expiring in 3 days.`);

    // Send push notification to the shop owner
    for (const shop of expiringShops) {
      if (!shop.userId) continue;

      try {
        await notificationServices.sendSingleNotification(
          shop.userId, // sender
          shop.userId, // receiver
          {
            title: "Trial Expiring Soon! ⏰",
            body: `Your free trial for ${shop.name} expires in exactly 3 days. Upgrade to Premium to keep your shop active!`,
          }
        );

        console.log(`Notified shop owner ${shop.userId} about trial expiry for: ${shop.name}`);
      } catch (error) {
        console.error(`Failed to notify trial expiry for shop ${shop.id}:`, error);
      }
    }

  } catch (error) {
    console.error("Error checking trial expirations:", error);
  }
};
