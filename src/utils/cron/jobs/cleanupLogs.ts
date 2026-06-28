import * as fs from "fs";
import * as path from "path";
import logger from "../../logger";

/**
 * Cleanup old log files (older than 30 days)
 */
export async function cleanupOldLogs(): Promise<void> {
    try {
        const logsDir = path.join(process.cwd(), "logs");

        if (!fs.existsSync(logsDir)) {
            logger.warn("Logs directory does not exist");
            return;
        }

        const files = fs.readdirSync(logsDir);
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);

            if (stats.isFile() && stats.mtimeMs < thirtyDaysAgo) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }

        logger.info(`Cleaned up ${deletedCount} old log files`);
    } catch (error) {
        logger.error("Error cleaning up old logs:", error);
        throw error;
    }
}
