import logger from "../../logger";
import { prisma } from "../../prisma";
import admin from "../../../app/helper/firebaseAdmin";

/**
 * Send reminder notifications to users who haven't completed 200 steps by 7:00 PM - TESTING
 * Runs every day at 7:00 PM Server Local Time
 */
export async function sendStepReminders(): Promise<void> {
    try {
        const currentTime = new Date();
        const localTimeStr = currentTime.toLocaleString();
        const utcTimeStr = currentTime.toUTCString();
        logger.info("=".repeat(80));
        logger.info(`🚀 Starting step reminder job`);
        logger.info(`📅 Server Local Time: ${localTimeStr}`);
        logger.info(`🌍 UTC Time: ${utcTimeStr}`);
        logger.info("=".repeat(80));

        // Get today's date at start of day
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all users with remainder enabled and FCM token
        const users = await prisma.user.findMany({
            where: {
                remainder: true,
                fcmToken: { not: null },
                status: 'ACTIVE',
            },
            select: {
                id: true,
                name: true,
                email: true,
                fcmToken: true,
            },
        });

        logger.info(`📊 Found ${users.length} users with reminders enabled`);
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📱 STEP REMINDER NOTIFICATION JOB`);
        console.log(`📅 Server Local Time: ${localTimeStr}`);
        console.log(`🌍 UTC Time: ${utcTimeStr}`);
        console.log(`${'='.repeat(80)}`);
        console.log(`✅ Total users with reminders enabled: ${users.length}`);
        console.log(`${'='.repeat(80)}\n`);

        let remindersSent = 0;
        let remindersSkipped = 0;

        for (const user of users) {
            try {
                // Check if user has completed 2000 steps today - TESTING
                const todaySteps = await prisma.steps.findFirst({
                    where: {
                        userId: user.id,
                        date: {
                            gte: today,
                            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                        },
                    },
                });

                const stepsCompleted = todaySteps?.steps || 0;

                // Send reminder if steps are less than 2000- TESTING
                if (stepsCompleted < 2000) { // TESTING: Changed from 2000
                    console.log(`\n📤 Sending reminder to: ${user.name || user.email}`);
                    console.log(`   Steps: ${stepsCompleted}/2000`); // TESTING: Changed from 2000
                    console.log(`   FCM Token exists: ${user.fcmToken ? 'YES ✅' : 'NO ❌'}`);

                    // Save notification to database
                    await prisma.notifications.create({
                        data: {
                            senderId: user.id, // System notification
                            receiverId: user.id,
                            title: "Daily Step Reminder 🚶",
                            body: "Don't forget to complete your daily walking goal! Keep moving to earn more points and unlock exciting deals.",
                        },
                    });
                    console.log(`   ✅ Notification saved to database`);

                    // Send push notification if FCM token exists
                    if (user.fcmToken) {
                        const message = {
                            notification: {
                                title: "Daily Step Reminder 🚶",
                                body: "Don't forget to complete your daily walking goal! Keep moving to earn more points and unlock exciting deals.",
                            },
                            token: user.fcmToken,
                        };

                        try {
                            const response = await admin.messaging().send(message);
                            remindersSent++;
                            console.log(`   ✅ Push notification SENT successfully!`);
                            console.log(`   📱 Firebase Response: ${response}`);
                            logger.info(
                                `✅ Sent step reminder to ${user.email} (${stepsCompleted}/2000 steps)` // TESTING: Changed from 2000
                            );
                        } catch (error: any) {
                            console.log(`   ❌ Push notification FAILED!`);
                            console.log(`   Error: ${error.message}`);
                            console.log(`   Error Code: ${error.code || 'N/A'}`);
                            logger.error(
                                `❌ Failed to send push notification to ${user.email}:`,
                                error.message
                            );
                        }
                    }
                } else {
                    remindersSkipped++;
                    console.log(`\n⏭️  Skipped: ${user.name || user.email} (${stepsCompleted}/2000 steps - Goal reached!)`); // TESTING: Changed from 2000
                    logger.info(
                        `Skipped reminder for ${user.email} (already completed ${stepsCompleted} steps)`
                    );
                }
            } catch (error: any) {
                console.log(`\n❌ Error processing user: ${user.email}`);
                console.log(`   Error: ${error.message}`);
                logger.error(
                    `Error processing reminder for user ${user.email}:`,
                    error.message
                );
            }
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 STEP REMINDER JOB COMPLETED`);
        console.log(`${'='.repeat(80)}`);
        console.log(`✅ Reminders sent: ${remindersSent}`);
        console.log(`⏭️  Reminders skipped: ${remindersSkipped}`);
        console.log(`👥 Total processed: ${users.length}`);
        console.log(`${'='.repeat(80)}\n`);

        logger.info(
            `Step reminder job completed. Sent: ${remindersSent}, Skipped: ${remindersSkipped}`
        );
    } catch (error) {
        logger.error("Step reminder job failed:", error);
        throw error;
    }
}

