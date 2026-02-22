/**
 * Idempotency middleware - requires Idempotency-Key header for execution endpoints
 * Returns stored response if duplicate key received.
 */
import { createHash } from "crypto";
import { NextFunction, Request, Response } from "express";
import * as IdempotencyRepository from "../../infrastructure/db/IdempotencyRepository";
import logger from "../logger";

export type IdempotencyHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

/**
 * Middleware that requires Idempotency-Key header.
 * Attaches storeDuplicateResponse(req, response) for the route handler to call
 * after successful execution.
 */
export function requireIdempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = (
    req.header("Idempotency-Key") ||
    req.header("idempotency-key") ||
    ""
  ).trim();
  const rid = req.requestId || null;

  if (!key) {
    logger.warn("idempotency.missing_key", { requestId: rid, path: req.path });
    res.status(400).json({
      requestId: rid,
      error: "missing_idempotency_key",
      message: "Idempotency-Key header is required for this endpoint",
    });
    return;
  }

  if (key.length > 64) {
    res.status(400).json({
      requestId: rid,
      error: "invalid_idempotency_key",
      message: "Idempotency-Key must be at most 64 characters",
    });
    return;
  }

  (req as Request & { idempotencyKey: string }).idempotencyKey = key;
  next();
}

/**
 * Compute request hash for idempotency (body + params + query)
 */
export function computeRequestHash(req: Request): string {
  const payload = JSON.stringify({
    body: req.body,
    params: req.params,
    query: req.query,
    path: req.path,
    method: req.method,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 64);
}

/**
 * Check for duplicate idempotency key and return stored response if found
 */
export async function checkIdempotency(
  req: Request & { idempotencyKey?: string },
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = (req as Request & { idempotencyKey?: string }).idempotencyKey;
  if (!key) return next();

  const requestHash = computeRequestHash(req);
  const existing = await IdempotencyRepository.findIdempotencyRecord(key);

  if (existing && existing.status === "completed") {
    logger.info("idempotency.duplicate_returned", {
      requestId: req.requestId,
      idempotencyKey: key,
    });
    res.json(existing.storedResponse as object);
    return;
  }

  (
    req as Request & { idempotencyKey: string; idempotencyRequestHash: string }
  ).idempotencyRequestHash = requestHash;
  next();
}

/**
 * Store response for idempotency (call after successful execution)
 */
export async function storeIdempotencyResponse(
  req: Request & { idempotencyKey?: string; idempotencyRequestHash?: string },
  response: object,
): Promise<void> {
  const key = req.idempotencyKey;
  const hash = req.idempotencyRequestHash;
  if (!key || !hash) return;

  await IdempotencyRepository.storeIdempotencyRecord(
    key,
    hash,
    response,
    "completed",
  );
}
