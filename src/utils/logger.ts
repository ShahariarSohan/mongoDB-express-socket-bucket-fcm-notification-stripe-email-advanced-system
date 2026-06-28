import winston from "winston";
import config from "../config";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }

    // Add stack trace for errors
    if (stack) {
        msg += `\n${stack}`;
    }

    return msg;
});

// Create logger instance
const logger = winston.createLogger({
    level: config.isDevelopment ? "debug" : "info",
    format: combine(
        errors({ stack: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        config.isDevelopment ? colorize() : winston.format.uncolorize(),
        logFormat
    ),
    transports: [
        // Console transport
        new winston.transports.Console({
            stderrLevels: ["error"],
        }),

        // File transport for errors
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),

        // File transport for all logs
        new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: "logs/exceptions.log" }),
    ],
    rejectionHandlers: [
        new winston.transports.File({ filename: "logs/rejections.log" }),
    ],
});

// Create a stream object for Morgan
export const morganStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

export default logger;
