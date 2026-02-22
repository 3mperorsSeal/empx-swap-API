import { Request, Response, NextFunction } from "express";
import logger from "../logger";

function sanitizeBody(body: any) {
  if (!body || typeof body !== "object") return body;
  const copy: any = Array.isArray(body) ? [] : {};
  for (const k of Object.keys(body)) {
    // Skip sensitive keys
    if (/password|token|secret|api[_-]?key|authorization/i.test(k)) {
      copy[k] = "[REDACTED]";
      continue;
    }
    const v = (body as any)[k];
    if (v && typeof v === "object") copy[k] = sanitizeBody(v);
    else copy[k] = v;
  }
  return copy;
}

export default function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = Date.now();
  const rid = req.requestId || null;

  // Log request start (info)
  try {
    const meta: any = {
      requestId: rid,
      path: req.path,
      method: req.method,
      ip: req.ip,
      host: req.hostname,
      apiKeyId: (req as any).apiKey?.id || null,
      key_prefix: (req as any).apiKey?.key_prefix || null,
      userId: (req as any).user?.id || null,
    };
    if ((process.env.LOG_VERBOSE || "false").toLowerCase() === "true") {
      meta.body = sanitizeBody(req.body);
      meta.query = req.query;
    }
    logger.info("request.start", meta);
  } catch (e) {
    // don't break requests for logging issues
    logger.error("request.start.log_error", { err: e });
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    try {
      const meta: any = {
        requestId: rid,
        path: req.path,
        method: req.method,
        status: res.statusCode,
        duration_ms: duration,
        ip: req.ip,
        host: req.hostname,
        apiKeyId: (req as any).apiKey?.id || null,
        key_prefix: (req as any).apiKey?.key_prefix || null,
        userId: (req as any).user?.id || null,
      };
      logger.info("request.complete", meta);
    } catch (e) {
      logger.error("request.finish.log_error", { err: e });
    }
  });

  next();
}
