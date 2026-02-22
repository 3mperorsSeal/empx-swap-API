import { Request, Response } from "express";
import config from "../../core/config";
import logger from "../../core/logger";
import * as service from "./service";

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
    dependencies: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
}

export function protectedTest(req: Request, res: Response) {
  res.json({ ok: true, message: "Protected route" });
}
