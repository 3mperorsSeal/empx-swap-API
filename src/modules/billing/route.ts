import express from "express";
import { grantMonthlyCreditsForApiKey } from "./service";
import { getUsage } from "../../services/quotaService";
import { validateBody, validateQuery } from "../../core/middleware/validate";
import logger from "../../core/logger";
import { z } from "zod";
const router = express.Router();

const purchaseBodySchema = z
  .object({
    credits: z.number().int().positive().optional(),
  })
  .strict();

const usageQuerySchema = z.object({});

// POST /v1/billing/purchase
// Body: { credits?: number }
// This is a simplified admin/purchase endpoint that grants credits immediately.
router.post(
  "/purchase",
  validateBody(purchaseBodySchema),
  async (req: any, res) => {
    try {
      const credits = Number(
        req.body.credits || process.env.PURCHASE_CREDITS || 1000,
      );
      const apiKey = req.apiKey || null;
      if (!apiKey) return res.status(401).json({ error: "missing_api_key" });

      // For production, this endpoint should create a Stripe Checkout session and wait for webhook confirmation.
      // Here we grant credits immediately for simplicity; ensure this route is protected in production.
      await grantMonthlyCreditsForApiKey(
        apiKey.id || null,
        apiKey.user_id || null,
        credits,
      );
      res.json({ ok: true, creditsGranted: credits });
    } catch (err) {
      logger.error("billing.purchase.error", {
        requestId: req.requestId || null,
        err,
        apiKeyId: req.apiKey?.id || null,
      });
      res.status(500).json({ error: "server_error" });
    }
  },
);

router.get("/usage", validateQuery(usageQuerySchema), async (req: any, res) => {
  try {
    const apiKey = req.apiKey || null;
    if (!apiKey) return res.status(401).json({ error: "missing_api_key" });
    const usage = await getUsage({
      apiKeyId: apiKey.id || null,
      userId: apiKey.user_id || null,
    });
    res.json({ ok: true, usage });
  } catch (err) {
    logger.error("billing.usage.error", {
      requestId: req.requestId || null,
      err,
      apiKeyId: req.apiKey?.id || null,
    });
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
