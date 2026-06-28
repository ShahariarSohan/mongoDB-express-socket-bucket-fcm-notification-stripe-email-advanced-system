import logger from "../../logger";
import { prisma } from "../../prisma";

/**
 * Cleanup expired OTPs from database
 */
export async function cleanupExpiredOTPs(): Promise<void> {
    try {
        const now = new Date();

        // Delete expired OTPs (older than their expiry time)
        const result = await prisma.oTP.deleteMany({
            where: {
                expiry: {
                    lt: now,
                },
            },
        });

        logger.info(`Cleaned up ${result.count} expired OTPs`);
    } catch (error) {
        logger.error("Error cleaning up expired OTPs:", error);
        throw error;
    }
}
