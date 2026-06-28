import Redis from "ioredis";
import config from "../config";
import logger from "./logger";

class RedisClient {
  private static instance: Redis | null = null;
  private client: Redis;

  private constructor() {
    this.client = new Redis({
      host: config.REDIS_HOST || "127.0.0.1",
      port: config.REDIS_PORT || 6379,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    this.client.on("connect", () => {
      logger.info("✅ Redis connected successfully (Local)");
    });

    this.client.on("error", (error) => {
      logger.error("❌ Redis connection error:", error);
    });

    this.client.on("reconnecting", () => {
      logger.info("🔄 Redis reconnecting...");
    });
  }

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      const redisClient = new RedisClient();
      RedisClient.instance = redisClient.client;
    }
    return RedisClient.instance;
  }

  public static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      logger.info("✅ Redis disconnected");
    }
  }
}

export const redis = RedisClient.getInstance();

// Cache helper functions
export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = 300): Promise<boolean> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  static async delete(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  static async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        return await redis.del(...keys);
      }
      return 0;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists check error for key ${key}:`, error);
      return false;
    }
  }

  static async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  static async hset(key: string, field: string, value: any): Promise<boolean> {
    try {
      await redis.hset(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache hset error for key ${key}:`, error);
      return false;
    }
  }

  static async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const data = await redis.hget(key, field);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache hget error for key ${key}:`, error);
      return null;
    }
  }

  static async incr(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  static async decr(key: string): Promise<number> {
    try {
      return await redis.decr(key);
    } catch (error) {
      logger.error(`Cache decr error for key ${key}:`, error);
      return 0;
    }
  }
}

export const disconnectRedis = RedisClient.disconnect;
