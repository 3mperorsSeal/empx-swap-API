import { Request, Response } from "express";
import logger from "../../core/logger";
import { getUsage } from "../../services/quotaService";
import { grantMonthlyCreditsForApiKey } from "./service";

/**
 * POST /v1/billing/purchase
 * Grants monthly credits to the requesting API key immediately.
 * In production this should be replaced with a Stripe Checkout session flow.
 */
export async function purchase(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const credits = Number(
      req.body?.credits || process.env.PURCHASE_CREDITS || 1000,
    );
    const apiKey = req.apiKey;
    if (!apiKey) return res.status(401).json({ error: "missing_api_key" });

    await grantMonthlyCreditsForApiKey(apiKey.id, apiKey.user_id, credits);
    res.json({ ok: true, creditsGranted: credits });
  } catch (err) {
    logger.error("billing.purchase.error", {
      requestId: rid,
      err,
      apiKeyId: req.apiKey?.id ?? null,
    });
    res.status(500).json({ error: "server_error" });
  }
}

/**
 * GET /v1/billing/usage
 * Returns current quota usage for the requesting API key.
 */
export async function usage(req: Request, res: Response) {
  const rid = req.requestId || null;
  try {
    const apiKey = req.apiKey;
    if (!apiKey) return res.status(401).json({ error: "missing_api_key" });

    const result = await getUsage({
      apiKeyId: apiKey.id,
      userId: apiKey.user_id,
    });
    res.json({ ok: true, usage: result });
  } catch (err) {
    logger.error("billing.usage.error", {
      requestId: rid,
      err,
      apiKeyId: req.apiKey?.id ?? null,
    });
    res.status(500).json({ error: "server_error" });
  }
}
