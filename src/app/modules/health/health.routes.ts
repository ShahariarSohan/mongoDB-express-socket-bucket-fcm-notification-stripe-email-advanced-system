import { Request, Response, Router } from "express";
import config from "../../../config";
import { prisma } from "../../../utils/prisma";

const router = Router();

/**
 * Basic health check endpoint
 * GET /health
 */
router.get("/health", async (_req: Request, res: Response) => {
    try {
        // Check database connectivity (MongoDB)
        await prisma.$runCommandRaw({ ping: 1 });

        res.status(200).json({
            success: true,
            message: "Server is healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config.NODE_ENV,
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            message: "Server is unhealthy",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * Detailed health check endpoint
 * GET /health/detailed
 */
router.get("/health/detailed", async (_req: Request, res: Response) => {
    const checks: Record<string, any> = {
        server: {
            status: "healthy",
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
        },
        database: {
            status: "unknown",
            connected: false,
        },
    };

    // Check database
    try {
        await prisma.$runCommandRaw({ ping: 1 });
        checks.database.status = "healthy";
        checks.database.connected = true;
    } catch (error) {
        checks.database.status = "unhealthy";
        checks.database.error =
            error instanceof Error ? error.message : "Unknown error";
    }

    const isHealthy = checks.database.status === "healthy";

    res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
        checks,
    });
});

/**
 * Liveness probe for Kubernetes/Docker
 * GET /health/liveness
 */
router.get("/health/liveness", (_req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        alive: true,
        timestamp: new Date().toISOString(),
    });
});

/**
 * Readiness probe for Kubernetes/Docker
 * GET /health/readiness
 */
router.get("/health/readiness", async (_req: Request, res: Response) => {
    try {
        await prisma.$runCommandRaw({ ping: 1 });
        res.status(200).json({
            success: true,
            ready: true,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            ready: false,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
        });
    }
});

export const healthRouter = router;
