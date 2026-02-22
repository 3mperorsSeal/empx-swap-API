import { Request, Response } from "express";
import { isAppError } from "../../core/errors";
import logger from "../../core/logger";
import * as service from "./service";

export async function getChains(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const chains = await service.listChains();
    const total = Array.isArray(chains) ? chains.length : 0;
    res.json({ requestId: rid, meta: { total }, total, chains });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("chains.controller.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("chains.controller.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function getTokens(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const { chainId } = req.params as any;
    const { search = "", limit = "25", offset = "0" } = req.query as any;
    const l = Math.min(100, Math.max(1, Number(limit) || 25));
    const o = Math.max(0, Number(offset) || 0);
    const chain = await service.getChain(chainId);
    if (!chain)
      return res.status(404).json({ requestId: rid, error: "chain_not_found" });
    const result = await service.listTokens(chainId, String(search), l, o);
    res.json({
      requestId: rid,
      meta: { total: result.total, limit: l, offset: o },
      total: result.total,
      items: result.items,
    });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("chains.tokens.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("chains.tokens.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}

export async function getAdapters(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const { chainId } = req.params as any;
    const chain = await service.getChain(chainId);
    if (!chain)
      return res.status(404).json({ requestId: rid, error: "chain_not_found" });
    const result = await service.listAdapters(chainId);
    res.json({
      requestId: rid,
      meta: { total: result.total },
      total: result.total,
      items: result.items,
    });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("chains.adapters.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("chains.adapters.error", { requestId: rid, err });
    res.status(500).json({ requestId: rid, error: "internal_server_error" });
  }
}
