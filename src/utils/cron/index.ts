import cron, { ScheduledTask } from "node-cron";
import logger from "../logger";
import { prisma } from "../prisma";
import { backupDatabase } from "./jobs/backupDatabase";
import { cleanupOldLogs } from "./jobs/cleanupLogs";
import { cleanupExpiredOTPs } from "./jobs/cleanupOTPs";
// import { generateDailyReports } from "./jobs/generateReports"; // Disabled
import { updateVoucherStatus } from "./jobs/updateVoucherStatus";
import { checkExpiredDeals } from "./jobs/checkExpiredDeals";
import { sendStepReminders } from "./jobs/sendStepReminders";
import { sendIosAppReminder } from "./jobs/sendIosAppReminder";
import { checkTrialExpiry } from "./jobs/checkTrialExpiry";

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs(): void {
    logger.info("Initializing cron jobs...");

    // Cleanup expired OTPs - Every day at 00:00 (midnight) Server Local Time
    cron.schedule("0 0 * * *", async () => {
        logger.info("Running OTP cleanup job");
        try {
            await cleanupExpiredOTPs();
            logger.info("OTP cleanup job completed successfully");
        } catch (error) {
            logger.error("OTP cleanup job failed:", error);
        }
    });

    // Update voucher status based on deal expiry - Every hour Server Local Time
    cron.schedule("0 * * * *", async () => {
        logger.info("Running voucher status update job");
        try {
            await updateVoucherStatus();
            logger.info("Voucher status update job completed successfully");
        } catch (error) {
            logger.error("Voucher status update job failed:", error);
        }
    });

    // Check for expired deals and notify shop owners - Every day at midnight Server Local Time
    cron.schedule("0 0 * * *", async () => {
        logger.info("Running expired deals check job");
        try {
            await checkExpiredDeals();
            logger.info("Expired deals check job completed successfully");
        } catch (error) {
            logger.error("Expired deals check job failed:", error);
        }
    });

    // Check for trial expiry and notify shop owners - Every day at midnight Server Local Time
    cron.schedule("0 0 * * *", async () => {
        logger.info("Running trial expiry check job");
        try {
            await checkTrialExpiry();
            logger.info("Trial expiry check job completed successfully");
        } catch (error) {
            logger.error("Trial expiry check job failed:", error);
        }
    });

    // Send step reminders - Every day at 19:00 (7:00 PM) Server Local Time
    const stepReminderJob = cron.schedule("0 19 * * *", async () => {
        const serverTime = new Date();
        const localTimeStr = serverTime.toLocaleString();
        logger.info(`🕐 Running step reminder job at Server Local Time: ${localTimeStr}`);
        console.log(`\n${'='.repeat(80)}`);
        console.log(`⏰ CRON JOB TRIGGERED - Server Local Time: ${localTimeStr}`);
        console.log(`🌍 UTC Time: ${serverTime.toUTCString()}`);
        console.log(`${'='.repeat(80)}\n`);
        try {
            await sendStepReminders();
            logger.info("Step reminder job completed successfully");
        } catch (error) {
            logger.error("Step reminder job failed:", error);
        }
    });

    // Log the scheduled time
    const currentServerTime = new Date();
    const currentLocalTimeStr = currentServerTime.toLocaleString();
    const currentUTCStr = currentServerTime.toUTCString();
    logger.info(`📅 Current Server Local Time: ${currentLocalTimeStr}`);
    logger.info(`🌍 Current UTC Time: ${currentUTCStr}`);
    logger.info(`⏰ Step reminder scheduled for: 7:00 PM (19:00) Server Local Time (Every day)`);
    console.log(`\n${'*'.repeat(80)}`);
    console.log(`📅 CURRENT SERVER LOCAL TIME: ${currentLocalTimeStr}`);
    console.log(`🌍 CURRENT UTC TIME: ${currentUTCStr}`);
    console.log(`⏰ NEXT STEP REMINDER: 7:00 PM (19:00) SERVER LOCAL TIME`);
    console.log(`   Note: This uses the server's local timezone automatically`);
    console.log(`${'*'.repeat(80)}\n`);

    // Send iOS app reminder - 21:00 UTC daily, each user gets this reminder every 2 days at the same time
    cron.schedule("0 21 * * *", async () => {
        logger.info("Running iOS app reminder job at 21:00 UTC");
        try {
            await sendIosAppReminder();
            logger.info("iOS app reminder job completed successfully");
        } catch (error) {
            logger.error("iOS app reminder job failed:", error);
        }
    }, {
        timezone: "UTC",
    });

    // Generate daily reports - Every day at 01:00 (1 AM)
    // cron.schedule("0 1 * * *", async () => {
    //     logger.info("Running daily reports generation job");
    //     try {
    //         await generateDailyReports();
    //         logger.info("Daily reports generation completed successfully");
    //     } catch (error) {
    //         logger.error("Daily reports generation failed:", error);
    //     }
    // });

    // Cleanup old logs - Every week on Sunday at 02:00 (2 AM) Server Local Time
    cron.schedule("0 2 * * 0", async () => {
        logger.info("Running log cleanup job");
        try {
            await cleanupOldLogs();
            logger.info("Log cleanup completed successfully");
        } catch (error) {
            logger.error("Log cleanup failed:", error);
        }
    });

    // Database backup - Every day at 03:00 (3 AM) Server Local Time
    cron.schedule("0 3 * * *", async () => {
        logger.info("Running database backup job");
        try {
            await backupDatabase();
            logger.info("Database backup completed successfully");
        } catch (error) {
            logger.error("Database backup failed:", error);
        }
    });

    // Cleanup inactive sessions - Every 6 hours Server Local Time
    cron.schedule("0 */6 * * *", async () => {
        logger.info("Running inactive session cleanup job");
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Clean up old OTPs and inactive records
            const deletedCount = await prisma.oTP.deleteMany({
                where: {
                    createdAt: {
                        lt: thirtyDaysAgo,
                    },
                },
            });

            logger.info(
                `Cleaned up ${deletedCount.count} inactive session records`
            );
        } catch (error) {
            logger.error("Inactive session cleanup failed:", error);
        }
    });

    logger.info("✅ All cron jobs initialized successfully with Server Local Timezone");
    logger.info("💡 Tip: Cron jobs will run based on the server's local time automatically");
}

/**
 * Validate cron expression
 */
export function isValidCronExpression(expression: string): boolean {
    return cron.validate(expression);
}

/**
 * Schedule a custom cron job
 */
export function scheduleJob(
    expression: string,
    name: string,
    callback: () => Promise<void>
): ScheduledTask | null {
    if (!isValidCronExpression(expression)) {
        logger.error(`Invalid cron expression: ${expression}`);
        return null;
    }

    logger.info(`Scheduling custom job: ${name}`);
    return cron.schedule(expression, async () => {
        logger.info(`Running custom job: ${name}`);
        try {
            await callback();
            logger.info(`Custom job ${name} completed successfully`);
        } catch (error) {
            logger.error(`Custom job ${name} failed:`, error);
        }
    });
}
