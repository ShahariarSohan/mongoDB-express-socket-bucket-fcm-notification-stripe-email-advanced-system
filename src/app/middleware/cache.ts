import { NextFunction, Request, Response } from "express";
import logger from "../../utils/logger";
import { CacheService } from "../../utils/redis";

/**
 * Cache middleware for GET requests
 * @param duration - Cache duration in seconds (default: 300 = 5 minutes)
 */
export const cacheMiddleware = (duration: number = 300) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== "GET") {
            return next();
        }

        // Generate cache key from URL and query params
        const cacheKey = `cache:${req.originalUrl || req.url}`;

        try {
            // Check if data exists in cache
            const cachedData = await CacheService.get(cacheKey);

            if (cachedData) {
                logger.debug(`Cache HIT for key: ${cacheKey}`);
                return res.status(200).json({
                    ...cachedData,
                    fromCache: true,
                });
            }

            logger.debug(`Cache MISS for key: ${cacheKey}`);

            // Store original json method
            const originalJson = res.json.bind(res);

            // Override json method to cache the response
            res.json = function (body: any) {
                // Cache the response
                CacheService.set(cacheKey, body, duration).catch((error) => {
                    logger.error(`Failed to cache response for ${cacheKey}:`, error);
                });

                // Call original json method
                return originalJson(body);
            };

            next();
        } catch (error) {
            logger.error(`Cache middleware error for ${cacheKey}:`, error);
            // Continue without caching on error
            next();
        }
    };
};

/**
 * Clear cache for specific pattern
 */
export const clearCache = (pattern: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await CacheService.deletePattern(pattern);
            logger.info(`Cache cleared for pattern: ${pattern}`);
        } catch (error) {
            logger.error(`Failed to clear cache for pattern ${pattern}:`, error);
        }
        next();
    };
};

/**
 * Clear cache after mutation (POST, PUT, PATCH, DELETE)
 */
export const clearCacheAfterMutation = (patterns: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to clear cache after response
        res.json = function (body: any) {
            // Clear cache patterns after successful mutation
            if (res.statusCode >= 200 && res.statusCode < 300) {
                patterns.forEach(async (pattern) => {
                    try {
                        await CacheService.deletePattern(pattern);
                        logger.info(`Cache cleared for pattern: ${pattern}`);
                    } catch (error) {
                        logger.error(`Failed to clear cache for pattern ${pattern}:`, error);
                    }
                });
            }

            // Call original json method
            return originalJson(body);
        };

        next();
    };
};
