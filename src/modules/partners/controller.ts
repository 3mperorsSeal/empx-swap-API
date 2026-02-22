// src/modules/partners/controller.ts
import { Request, Response } from "express";
import { isAppError } from "../../core/errors";
import logger from "../../core/logger";
import * as service from "./service";

export const listPartners = async (_req: Request, res: Response) => {
  const rid = _req.requestId || null;
  try {
    const partners = await service.listPartners();
    res.json({ requestId: rid, success: true, data: partners });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("partners.list.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("partners.list.error", { requestId: rid, err });
    return res
      .status(500)
      .json({ requestId: rid, error: "internal_server_error" });
  }
};

export const getPartner = async (req: Request, res: Response) => {
  const rid = req.requestId || null;
  try {
    const partner = await service.getPartnerById(req.params.id);

    if (!partner) {
      return res
        .status(404)
        .json({ requestId: rid, message: "Partner not found" });
    }

    return res.json({ requestId: rid, success: true, data: partner });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("partners.get.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("partners.get.error", { requestId: rid, err });
    return res
      .status(500)
      .json({ requestId: rid, error: "internal_server_error" });
  }
};

export const createPartner = async (req: Request, res: Response) => {
  const rid = req.requestId || null;
  try {
    const partner = await service.createPartner(req.body);
    return res.json({ requestId: rid, success: true, data: partner });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("partners.create.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("partners.create.error", { requestId: rid, err });
    return res
      .status(500)
      .json({ requestId: rid, error: "internal_server_error" });
  }
};

export const updatePartner = async (req: Request, res: Response) => {
  const rid = req.requestId || null;
  try {
    const partner = await service.updatePartner(req.params.id, req.body);

    if (!partner) {
      return res
        .status(404)
        .json({ requestId: rid, message: "Partner not found" });
    }

    return res.json({ requestId: rid, success: true, data: partner });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("partners.update.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("partners.update.error", { requestId: rid, err });
    return res
      .status(500)
      .json({ requestId: rid, error: "internal_server_error" });
  }
};

export const deletePartner = async (req: Request, res: Response) => {
  const rid = req.requestId || null;
  try {
    await service.deletePartner(req.params.id);
    return res.json({ requestId: rid, success: true });
  } catch (err) {
    if (isAppError(err)) {
      logger.warn("partners.delete.app_error", {
        requestId: rid,
        code: err.code,
        status: err.status,
      });
      return res.status(err.status).json({ requestId: rid, error: err.code });
    }
    logger.error("partners.delete.error", { requestId: rid, err });
    return res
      .status(500)
      .json({ requestId: rid, error: "internal_server_error" });
  }
};
