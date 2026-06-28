import logger from "../../logger";
import { prisma } from "../../prisma";

/**
 * Update voucher isActive status based on deal expiry
 * Runs every hour to check and update vouchers whose deals have expired
 */
export async function updateVoucherStatus(): Promise<void> {
    try {
        logger.info("Starting voucher status update job");

        const now = new Date();

        // Find all active vouchers where the associated deal has expired
        const expiredVouchers = await prisma.voucher.findMany({
            where: {
                isActive: true,
                deal: {
                    validTo: {
                        lt: now,
                    },
                },
            },
            include: {
                deal: true,
            },
        });

        if (expiredVouchers.length > 0) {
            logger.info(`Found ${expiredVouchers.length} expired vouchers to deactivate`);

            // Update all expired vouchers to inactive
            await prisma.voucher.updateMany({
                where: {
                    id: {
                        in: expiredVouchers.map((v) => v.id),
                    },
                },
                data: {
                    isActive: false,
                },
            });

            logger.info(`Successfully deactivated ${expiredVouchers.length} vouchers`);
        } else {
            logger.info("No expired vouchers found");
        }

        // Also activate vouchers whose deals are now valid (in case they were created early)
        const validVouchers = await prisma.voucher.findMany({
            where: {
                isActive: false,
                isRedeemed: false,
                deal: {
                    validFrom: {
                        lte: now,
                    },
                    validTo: {
                        gte: now,
                    },
                },
            },
        });

        if (validVouchers.length > 0) {
            logger.info(`Found ${validVouchers.length} vouchers to activate`);

            await prisma.voucher.updateMany({
                where: {
                    id: {
                        in: validVouchers.map((v) => v.id),
                    },
                },
                data: {
                    isActive: true,
                },
            });

            logger.info(`Successfully activated ${validVouchers.length} vouchers`);
        }

        logger.info("Voucher status update job completed successfully");
    } catch (error) {
        logger.error("Voucher status update job failed:", error);
        throw error;
    }
}
