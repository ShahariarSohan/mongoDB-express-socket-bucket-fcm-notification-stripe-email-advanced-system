import compression from "compression";
import { Application } from "express";
import mongoSanitize from "express-mongo-sanitize";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";
import config from "../../config";

/**
 * Apply security middleware to Express app
 */
export const applySecurityMiddleware = (app: Application) => {
    // Set security HTTP headers
    app.use(
        helmet({
            contentSecurityPolicy: config.isProduction ? undefined : false,
            crossOriginEmbedderPolicy: false,
        })
    );

    // Gzip compression
    app.use(
        compression({
            level: 6,
            threshold: 100 * 1024, // Only compress responses > 100KB
            filter: (req: any, res: any) => {
                if (req.headers["x-no-compression"]) {
                    return false;
                }
                return compression.filter(req, res);
            },
        })
    );

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: config.isProduction ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
        message: "Too many requests from this IP, please try again later.",
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use("/api", limiter);

    // Sanitize data to prevent NoSQL injection
    app.use(
        mongoSanitize({
            replaceWith: "_",
            onSanitize: ({ req, key }) => {
                console.warn(`Sanitized key: ${key} in request`);
            },
        })
    );

    // Prevent HTTP Parameter Pollution
    app.use(hpp());
};

/**
 * Apply CORS middleware
 */
export const applyCorsMiddleware = (app: Application) => {
    // CORS is already configured in app.ts
    // You can enhance it here if needed
};
