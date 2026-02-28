import { NextFunction, Request, RequestHandler, Response } from "express";
import Redis from "ioredis";
import { consumeCredit } from "../../services/quotaService";
import { AppError } from "../errors";
import logger from "../logger";
import {
  normaliseRoute,
  quotaExceededTotal,
  rateLimitExceededTotal,
} from "../metrics";

// Tier limits (rpm)
const TIER_LIMITS: Record<string, { rpm: number; burst: number }> = {
  anonymous: { rpm: 10, burst: 20 },
  free: { rpm: 100, burst: 150 },
  developer: { rpm: 1000, burst: 1500 },
  pro: { rpm: 10000, burst: 15000 },
};

function getLimitsForTier(tier?: string) {
  if (!tier) return TIER_LIMITS.free;
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

// Lua script for token bucket. Returns {allowed (1/0), tokens_left}
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_sec = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local data = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(data[1]) or capacity
local ts = tonumber(data[2]) or now
local delta = math.max(0, now - ts)
local filled = math.min(capacity, tokens + delta * refill_per_sec)
if filled < requested then
  redis.call("HMSET", key, "tokens", filled, "ts", now)
  redis.call("EXPIRE", key, 3600)
  return {0, filled}
else
  local newtokens = filled - requested
  redis.call("HMSET", key, "tokens", newtokens, "ts", now)
  redis.call("EXPIRE", key, 3600)
  return {1, newtokens}
end
`;

/**
 * Creates a rate-limiting middleware backed by the supplied Redis client.
 * When redis is null, falls back to an in-process token-bucket map (dev only).
 */
export function createRateLimiter(redis: Redis | null): RequestHandler {
  const memoryBuckets: Map<
    string,
    { tokens: number; last: number; capacity: number; refillPerSec: number }
  > = new Map();

  return async function rateLimiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    // Test mode bypass
    if (process.env.NODE_ENV === "test") {
      return next();
    }

    try {
      const prefix = req.apiKey?.key_prefix || req.ip || "anon";
      const tier = req.apiKey?.tier || "anonymous";
      const { rpm, burst } = getLimitsForTier(tier);

      const capacity = burst;
      const refillPerSec = rpm / 60.0;
      const now = Math.floor(Date.now() / 1000);
      const requested = 1;

      let allowed = true;
      let tokensLeft = capacity;

      if (redis) {
        try {
          const redisKey = `tb:${prefix}`;
          const resv: any = await redis.eval(
            TOKEN_BUCKET_LUA,
            1,
            redisKey,
            String(capacity),
            String(refillPerSec),
            String(now),
            String(requested),
          );
          allowed = Number(resv[0]) === 1;
          tokensLeft = Number(resv[1]);
        } catch (err) {
          logger.error("rate_limiter.redis_eval_failure", {
            err: err instanceof Error ? err.message : String(err),
          });
          // Fail-open on Redis error
        }
      } else {
        // In-memory token bucket fallback
        const key = prefix;
        const nowMs = Date.now();
        const bucket = memoryBuckets.get(key) || {
          tokens: capacity,
          last: nowMs,
          capacity,
          refillPerSec,
        };
        const deltaMs = Math.max(0, nowMs - bucket.last);
        const refill = (deltaMs / 1000) * bucket.refillPerSec;
        bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refill);
        bucket.last = nowMs;

        if (bucket.tokens < requested) {
          allowed = false;
          tokensLeft = bucket.tokens;
        } else {
          bucket.tokens -= requested;
          allowed = true;
          tokensLeft = bucket.tokens;
        }
        memoryBuckets.set(key, bucket);
      }

      res.setHeader("X-RateLimit-Limit", String(rpm));
      res.setHeader("X-RateLimit-Remaining", String(Math.floor(tokensLeft)));
      res.setHeader(
        "X-RateLimit-Reset",
        String(
          now +
            Math.ceil((capacity - tokensLeft) / Math.max(0.1, refillPerSec)),
        ),
      );

      if (!allowed) {
        const route = normaliseRoute(req.path);
        try {
          rateLimitExceededTotal.inc({ tier, route });
        } catch (_) {}
        logger.warn("rate_limit.exceeded", {
          requestId: req.requestId,
          prefix,
          tier,
          ip: req.ip,
          path: req.path,
        });
        res.setHeader("Retry-After", "1");
        return next(
          new AppError("rate_limit_exceeded", "Rate limit exceeded", 429),
        );
      }

      // Check usage quotas
      try {
        let fullPath = req.baseUrl + req.path;
        if (fullPath.endsWith("/") && fullPath.length > 1) {
          fullPath = fullPath.slice(0, -1);
        }

        const quotaRes = await consumeCredit({
          apiKeyId: req.apiKey?.id ? Number(req.apiKey.id) : null,
          userId: req.apiKey?.user_id ? Number(req.apiKey.user_id) : null,
          path: fullPath,
          method: req.method.toLowerCase(),
          cost: 1,
          tier: req.apiKey?.tier,
        });

        if (!quotaRes.allowed) {
          const route = normaliseRoute(req.path);
          try {
            quotaExceededTotal.inc({
              tier: req.apiKey?.tier || "unknown",
              quota_type:
                quotaRes.remainingPaid !== undefined ? "paid" : "free",
            });
          } catch (_) {}
          res.setHeader("Retry-After", "60");
          return next(new AppError("quota_exceeded", "Quota exceeded", 429));
        }

        if (quotaRes.remainingPaid !== undefined) {
          res.setHeader(
            "X-Quota-Paid-Remaining",
            String(quotaRes.remainingPaid),
          );
        }
        if (quotaRes.remainingFree !== undefined) {
          res.setHeader(
            "X-Quota-Free-Remaining",
            String(quotaRes.remainingFree),
          );
        }
      } catch (e: any) {
        logger.error("rate_limiter.quota_check_failure", {
          err: e instanceof Error ? e.message : String(e),
        });
        // Fail-open on quota service failure
      }

      next();
    } catch (err) {
      logger.error("rate_limiter.failure", {
        err: err instanceof Error ? err.message : String(err),
      });
      next();
    }
  };
}

/** Pre-built middleware using no Redis (in-memory fallback). Kept for backward compatibility. */
export const rateLimiter = createRateLimiter(null);
export default rateLimiter;
