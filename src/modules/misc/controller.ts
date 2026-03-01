import { Request, Response } from "express";
import config from "../../core/config";
import logger from "../../core/logger";
import * as service from "./service";

/** Liveness probe – the process is running and event-loop is ticking. */
export function liveness(_req: Request, res: Response) {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
}

/**
 * Readiness probe – the service is ready to accept traffic.
 * Checks all critical external dependencies (DB, Redis).
 * Returns 503 if any dependency is unhealthy.
 */
export async function readiness(req: Request, res: Response) {
  const checks: Record<string, { status: string; latency_ms?: number }> = {};
  let ready = true;

  // Database
  const dbStart = Date.now();
  try {
    await service.checkDatabase();
    checks.database = { status: "ok", latency_ms: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: "error", latency_ms: Date.now() - dbStart };
    ready = false;
    logger.warn("health.ready.database_unhealthy", {
      requestId: req.requestId || null,
      err,
    });
  }

  // Redis (optional)
  if (config.REDIS_URL) {
    const redisStart = Date.now();
    try {
      const result = await service.checkRedis();
      checks.redis = {
        status: result === "ok" ? "ok" : "degraded",
        latency_ms: Date.now() - redisStart,
      };
      if (result !== "ok") ready = false;
    } catch (err) {
      checks.redis = { status: "error", latency_ms: Date.now() - redisStart };
      ready = false;
      logger.warn("health.ready.redis_unhealthy", {
        requestId: req.requestId || null,
        err,
      });
    }
  } else {
    checks.redis = { status: "skipped" };
  }

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Legacy /status endpoint – kept for backwards compatibility.
 * Combines liveness + readiness data and adds version/build info.
 */
export async function status(req: Request, res: Response) {
  let dbStatus = "ok";
  let redisStatus = "ok";

  try {
    await service.checkDatabase();
  } catch (err) {
    dbStatus = "error";
    logger.warn("misc.status.database_unhealthy", {
      requestId: req.requestId || null,
      err,
    });
  }

  if (config.REDIS_URL) {
    try {
      redisStatus = await service.checkRedis();
    } catch (err) {
      redisStatus = "error";
      logger.warn("misc.status.redis_unhealthy", {
        requestId: req.requestId || null,
        err,
      });
    }
  } else {
    redisStatus = "skipped (no url)";
  }

  const isHealthy =
    dbStatus === "ok" && (config.REDIS_URL ? redisStatus === "ok" : true);

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "error",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "0.1.0",
    env: config.NODE_ENV,
    dependencies: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
}

export function protectedTest(req: Request, res: Response) {
  res.json({ ok: true, message: "Protected route" });
}
