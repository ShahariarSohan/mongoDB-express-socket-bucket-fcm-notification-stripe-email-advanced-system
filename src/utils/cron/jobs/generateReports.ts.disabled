import logger from "../../logger";
import { prisma } from "../../prisma";

/**
 * Generate daily reports for analytics
 */
export async function generateDailyReports(): Promise<void> {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Count new users registered yesterday
        const newUsers = await prisma.user.count({
            where: {
                createdAt: {
                    gte: yesterday,
                    lt: today,
                },
            },
        });

        // Count bookings created yesterday
        const newBookings = await prisma.booking.count({
            where: {
                createdAt: {
                    gte: yesterday,
                    lt: today,
                },
            },
        });

        // Count reviews submitted yesterday
        const newReviews = await prisma.review.count({
            where: {
                createdAt: {
                    gte: yesterday,
                    lt: today,
                },
            },
        });

        logger.info("Daily Report Generated:", {
            date: yesterday.toISOString().split("T")[0],
            newUsers,
            newBookings,
            newReviews,
        });

        // You can store this in a DailyReport model or send to analytics service
    } catch (error) {
        logger.error("Error generating daily reports:", error);
        throw error;
    }
}
