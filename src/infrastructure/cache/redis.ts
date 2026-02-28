/**
 * Redis client factory.
 * Returns null when no URL is provided so callers can degrade gracefully.
 */
import Redis from "ioredis";
import logger from "../../core/logger";

/**
 * Creates and returns a connected ioredis client, or null if no URL is given.
 * Errors are logged but do not throw — the rate-limiter falls back to in-memory.
 */
export function createRedisClient(url?: string): Redis | null {
  if (!url) {
    logger.warn("redis.no_url", {
      msg: "REDIS_URL not set — Redis-backed features will use in-memory fallback",
    });
    return null;
  }

  const client = new Redis(url);
  client.on("error", (err) => {
    logger.error("redis.error", {
      err: err instanceof Error ? err.message : String(err),
    });
  });
  return client;
}
