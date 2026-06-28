import { Job, Worker } from "bullmq";
import nodemailer from "nodemailer";
import config from "../../../config";
import logger from "../../logger";

const connection = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: null,
};

// Create email transporter
const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
    auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
    },
});

// Email Worker
export const emailWorker = new Worker(
    "email",
    async (job: Job) => {
        const { to, subject, html, from } = job.data;

        logger.info(`Processing email job ${job.id} for ${to}`);

        try {
            const info = await transporter.sendMail({
                from: from || config.SMTP_FROM_EMAIL,
                to,
                subject,
                html,
            });

            logger.info(`Email sent successfully: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error(`Failed to send email:`, error);
            throw error; // Will trigger retry
        }
    },
    {
        connection,
        concurrency: 5, // Process 5 emails at a time
    }
);

// Email Worker Events
emailWorker.on("completed", (job) => {
    logger.info(`✅ Email job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
    logger.error(`❌ Email job ${job?.id} failed:`, err.message);
});

emailWorker.on("error", (err) => {
    logger.error("Email worker error:", err);
});

export default emailWorker;
