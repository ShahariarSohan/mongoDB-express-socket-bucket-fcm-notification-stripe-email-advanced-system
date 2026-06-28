import { Job, Worker } from "bullmq";
import config from "../../../config";
import logger from "../../logger";
import { prisma } from "../../prisma";

const connection = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: null,
};

// Notification Worker
export const notificationWorker = new Worker(
    "notification",
    async (job: Job) => {
        const { userId, senderId, title, body, data } = job.data;

        logger.info(`Processing notification job ${job.id} for user ${userId}`);

        try {
            // Create notification in database
            const notification = await prisma.notifications.create({
                data: {
                    senderId: senderId || userId, // Use senderId if provided, otherwise use userId as sender
                    receiverId: userId,
                    title,
                    body,
                    read: false,
                },
            });

            // TODO: Send push notification via FCM
            // If you have FCM configured, add that logic here

            logger.info(`Notification created successfully: ${notification.id}`);
            return { success: true, notificationId: notification.id };
        } catch (error) {
            logger.error(`Failed to create notification:`, error);
            throw error; // Will trigger retry
        }
    },
    {
        connection,
        concurrency: 10, // Process 10 notifications at a time
    }
);

// Notification Worker Events
notificationWorker.on("completed", (job) => {
    logger.info(`✅ Notification job ${job.id} completed`);
});

notificationWorker.on("failed", (job, err) => {
    logger.error(`❌ Notification job ${job?.id} failed:`, err.message);
});

notificationWorker.on("error", (err) => {
    logger.error("Notification worker error:", err);
});

export default notificationWorker;
