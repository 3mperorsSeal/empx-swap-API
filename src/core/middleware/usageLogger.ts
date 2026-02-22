import { NextFunction, Request, Response } from "express";
import prisma from "../../lib/prisma";
import logger from "../logger";

/**
 * Middleware to log API usage to the database.
 * Uses raw SQL via Prisma for partitioned tables.
 */
export function usageLogger(req: Request, res: Response, next: NextFunction) {
  res.on("finish", async () => {
    try {
      const apiKeyId = req.apiKey?.id || null;
      const path = req.path || req.originalUrl;
      const method = req.method;
      const status = res.statusCode;
      const cost = 1;
      const ip = req.ip;
      const requestId = req.requestId || null;

      try {
        await prisma.$executeRaw`
          INSERT INTO api_usage_logs (api_key_id, path, method, status, cost, ip, request_id)
          VALUES (${apiKeyId}, ${path}, ${method}, ${status}, ${cost}, ${ip}, ${requestId})
        `;
      } catch (e: any) {
        const msg = e && e.message ? e.message : String(e);
        // Fallback for older schema without request_id
        if (
          msg.includes('column "request_id"') ||
          msg.includes("undefined column")
        ) {
          try {
            await prisma.$executeRaw`
              INSERT INTO api_usage_logs (api_key_id, path, method, status, cost, ip, created_at)
              VALUES (${apiKeyId}, ${path}, ${method}, ${status}, ${cost}, ${ip}, now())
            `;
          } catch (e2: any) {
            logger.error("usageLogger.fallback_error", {
              err: e2 instanceof Error ? e2.message : String(e2),
              requestId,
            });
          }
        } else {
          logger.error("usageLogger.db_error", {
            err: msg,
            requestId,
          });
        }
      }
    } catch (err: any) {
      logger.error("usageLogger.unexpected_error", {
        err: err instanceof Error ? err.message : String(err),
        requestId: req.requestId || null,
      });
    }
  });
  next();
}
