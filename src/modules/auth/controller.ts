import { Request, Response } from "express";
import { isAppError } from "../../core/errors";
import logger from "../../core/logger";
import * as service from "./service";

export async function generateKey(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const { userId, tier, persist } = req.body || {};
    const result = await service.createApiKey({ userId, tier, persist });
    res.json({ requestId: rid, ...result });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("auth.generateKey.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("auth.generateKey.error", { requestId: rid, err });
    console.error("DEBUG: generateKey error:", err);
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function revokeKey(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const { prefix } = req.body || {};
    if (!prefix)
      return res.status(400).json({ requestId: rid, error: "missing_prefix" });
    const result = await service.revokeKey(prefix);
    res.json({ requestId: rid, ...result });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("auth.revokeKey.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("auth.revokeKey.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function me(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    // authMiddleware attaches req.apiKey
    res.json({ requestId: rid, apiKey: (req as any).apiKey || null });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("auth.me.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("auth.me.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}
