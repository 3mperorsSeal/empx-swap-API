import { Request, Response } from "express";
import { isAppError } from "../../core/errors";
import logger from "../../core/logger";
import * as service from "./service";

export async function register(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const result = await service.register(req.body || {});
    res.json({ requestId: rid, ...result });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("user.register.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("user.register.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function login(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const result = await service.login(req.body || {});
    res.json({ requestId: rid, ...result });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("user.login.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("user.login.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function me(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const user = (req as any).user;
    if (!user)
      return res.status(401).json({ requestId: rid, error: "unauthenticated" });
    res.json({ requestId: rid, user });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("user.me.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("user.me.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}
