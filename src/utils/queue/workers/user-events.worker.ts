import { Job, Worker } from "bullmq";
import config from "../../../config";
import logger from "../../logger";
import { addEmailJob, addNotificationJob } from "../index";

const connection = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: null,
};

/**
 * User Events Worker
 * Handles user-related events: created, updated, deleted
 */
const userEventsWorker = new Worker(
    "user-events",
    async (job: Job) => {
        const { name, data } = job;
        logger.info(`Processing user event: ${name}`, { jobId: job.id });

        try {
            switch (name) {
                case "user.created":
                    await handleUserCreated(data);
                    break;

                case "user.updated":
                    await handleUserUpdated(data);
                    break;

                case "user.deleted":
                    await handleUserDeleted(data);
                    break;

                default:
                    logger.warn(`Unknown user event type: ${name}`);
            }

            logger.info(`User event processed successfully: ${name}`);
            return { success: true, event: name };
        } catch (error) {
            logger.error(`Error processing user event ${name}:`, error);
            throw error; // Will trigger retry
        }
    },
    {
        connection,
        concurrency: 5, // Process 5 jobs concurrently
        limiter: {
            max: 10, // Max 10 jobs
            duration: 1000, // per second
        },
    }
);

/**
 * Handle user created event
 */
async function handleUserCreated(data: {
    userId: string;
    email: string;
    name?: string | null;
    role?: string;
}) {
    logger.info("Sending welcome email for new user:", data.userId);

    // Send welcome email
    await addEmailJob({
        to: data.email,
        subject: "Welcome to Cadence Platform! 🎉",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome ${data.name || "User"}! 🎉</h1>
                    </div>
                    <div class="content">
                        <h2>Thank you for joining Cadence!</h2>
                        <p>We're excited to have you on board. Here's what you can do next:</p>
                        <ul>
                            <li>✅ Complete your profile</li>
                            <li>📱 Enable notifications</li>
                            <li>🔍 Explore our services</li>
                            <li>📅 Book your first appointment</li>
                        </ul>
                        <p>If you have any questions, our support team is here to help!</p>
                        <a href="https://cadence.com/dashboard" class="button">Get Started</a>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Cadence. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    });

    // Send welcome notification
    await addNotificationJob({
        userId: data.userId,
        title: "Welcome to Cadence! 🎉",
        body: "Thanks for joining us. Let's get started!",
        data: {
            type: "welcome",
            action: "complete_profile",
        },
    });
}

/**
 * Handle user updated event
 */
async function handleUserUpdated(data: {
    userId: string;
    changes: Record<string, any>;
}) {
    logger.info("User profile updated:", data.userId);

    // Track important changes
    if (data.changes.email) {
        logger.info(`User ${data.userId} changed email to: ${data.changes.email}`);
        // Could send verification email here
    }

    if (data.changes.role) {
        logger.info(`User ${data.userId} role changed to: ${data.changes.role}`);
        // Send notification about role change
    }

    // You can add analytics tracking here
    // await trackEvent('user_profile_updated', { userId: data.userId, changes: Object.keys(data.changes) });
}

/**
 * Handle user deleted event
 */
async function handleUserDeleted(data: { userId: string; email: string }) {
    logger.warn("User account deleted:", data.userId);

    // Send account deletion confirmation email
    await addEmailJob({
        to: data.email,
        subject: "Account Deletion Confirmation",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #e74c3c; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Account Deleted</h1>
                    </div>
                    <div class="content">
                        <h2>We're sorry to see you go</h2>
                        <p>Your account has been successfully deleted from our platform.</p>
                        <p>All your data has been removed according to our privacy policy.</p>
                        <p>If this was a mistake or you'd like to return, you can always create a new account.</p>
                        <p>We hope to see you again in the future!</p>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Cadence. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    });

    // Cleanup tasks can be added here:
    // - Remove from cache
    // - Cancel pending bookings
    // - Archive user data
}

// Event handlers
userEventsWorker.on("completed", (job) => {
    logger.info(`User event job completed: ${job.id}`);
});

userEventsWorker.on("failed", (job, error) => {
    logger.error(`User event job failed: ${job?.id}`, error);
});

userEventsWorker.on("error", (error) => {
    logger.error("User events worker error:", error);
});

logger.info("✅ User events worker started");

export default userEventsWorker;
