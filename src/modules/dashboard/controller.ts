import { Request, Response } from "express";
import { isAppError } from "../../core/errors";
import logger from "../../core/logger";
import * as service from "./service";

export async function listKeys(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const user = (req as any).user || null;
    const { page, perPage, effectiveUserId } = service.resolveListKeysInput(
      user,
      req.query as Record<string, unknown>,
    );
    const result = await service.listKeys(effectiveUserId, page, perPage);
    res.json({
      requestId: rid,
      meta: { total: result.total, page, perPage },
      total: result.total,
      rows: result.rows,
    });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("dashboard.listKeys.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("dashboard.listKeys.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function createKey(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const user = (req as any).user;
    const { tier } = req.body || {};
    // create key for logged-in user and persist by default
    const result = await service.createKey({
      userId: user?.id ?? null,
      tier,
      persist: true,
    });
    res.json({ requestId: rid, ...result });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("dashboard.createKey.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("dashboard.createKey.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function revokeKey(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const { prefix } = req.body || {};
    if (!prefix)
      return res.status(400).json({ requestId: rid, error: "missing_prefix" });
    const user = (req as any).user;
    const isAdmin = user && user.role === "admin";
    const result = await service.revokeKeyByUser(
      prefix,
      user?.id ?? null,
      isAdmin,
    );
    if (result.notFound)
      return res.status(404).json({ requestId: rid, error: "key_not_found" });
    if (result.forbidden)
      return res.status(403).json({ requestId: rid, error: "forbidden" });
    res.json({ requestId: rid, ...result });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("dashboard.revokeKey.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("dashboard.revokeKey.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function patchWhitelist(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const prefix = req.params.prefix;
    if (!prefix)
      return res
        .status(400)
        .json({ requestId: rid, error: "missing_prefix_param" });
    const { whitelisted_ips, whitelisted_domains } = req.body || {};
    // Basic validation: must be arrays when provided
    if (whitelisted_ips && !Array.isArray(whitelisted_ips))
      return res
        .status(400)
        .json({ requestId: rid, error: "invalid_whitelisted_ips" });
    if (whitelisted_domains && !Array.isArray(whitelisted_domains))
      return res
        .status(400)
        .json({ requestId: rid, error: "invalid_whitelisted_domains" });

    const user = (req as any).user;
    const isAdmin = user && user.role === "admin";
    const updated = await service.updateWhitelistByUser(
      prefix,
      whitelisted_ips || null,
      whitelisted_domains || null,
      user?.id ?? null,
      isAdmin,
    );
    if (updated.notFound)
      return res.status(404).json({ requestId: rid, error: "key_not_found" });
    if (updated.forbidden)
      return res.status(403).json({ requestId: rid, error: "forbidden" });
    res.json({ requestId: rid, key: updated.key });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("dashboard.patchWhitelist.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("dashboard.patchWhitelist.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function getUsage(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const prefix = req.params.prefix;
    if (!prefix)
      return res
        .status(400)
        .json({ requestId: rid, error: "missing_prefix_param" });
    const { start, end, limit } = req.query || {};
    const l = limit ? Number(limit) : 30;
    const user = (req as any).user;
    const isAdmin = user && user.role === "admin";
    const data = await service.usageAnalyticsByUser(
      prefix,
      user?.id ?? null,
      isAdmin,
      start as string | undefined,
      end as string | undefined,
      l,
    );
    if (data.notFound)
      return res.status(404).json({ requestId: rid, error: "key_not_found" });
    if (data.forbidden)
      return res.status(403).json({ requestId: rid, error: "forbidden" });
    res.json({ requestId: rid, meta: { limit: l }, ...data });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("dashboard.getUsage.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("dashboard.getUsage.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}
