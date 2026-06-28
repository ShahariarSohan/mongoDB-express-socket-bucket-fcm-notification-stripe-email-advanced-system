import { PrismaClient } from "@prisma/client";
import { notificationServices } from "../../../app/modules/notifications/notification.service";

const prisma = new PrismaClient();

/**
 * Check for expired deals and notify shop owners
 * Runs every day at midnight
 */
export const checkExpiredDeals = async () => {
  try {
    const now = new Date();

    // Find deals that just expired (validTo is less than now but greater than 24 hours ago)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const expiredDeals = await prisma.deal.findMany({
      where: {
        validTo: {
          gte: oneDayAgo,
          lt: now,
        },
        status: 'ACTIVE', // Only active deals
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        _count: {
          select: {
            vouchers: true,
          },
        },
      },
    });

    console.log(`Found ${expiredDeals.length} expired deals`);

    // Send notification to shop owner for each expired deal
    for (const deal of expiredDeals) {
      try {
        await notificationServices.sendSingleNotification(
          deal.userId,
          deal.shop.userId,
          {
            title: "Deal Expired ⏰",
            body: `Your deal "${deal.name}" at ${deal.shop.name} has expired. Total vouchers claimed: ${deal._count.vouchers}`,
          }
        );

        // Optionally update deal status to PAUSE
        await prisma.deal.update({
          where: { id: deal.id },
          data: { status: 'PAUSE' },
        });

        console.log(`Notified shop owner about expired deal: ${deal.name}`);
      } catch (error) {
        console.error(`Failed to notify about expired deal ${deal.id}:`, error);
      }
    }

    console.log("Expired deals check completed successfully");
  } catch (error) {
    console.error("Error checking expired deals:", error);
  }
};
