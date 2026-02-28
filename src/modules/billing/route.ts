import express from "express";
import { z } from "zod";
import { validateBody, validateQuery } from "../../core/middleware/validate";
import { purchase, usage } from "./controller";

const router = express.Router();

const purchaseBodySchema = z
  .object({
    credits: z.number().int().positive().optional(),
  })
  .strict();

const usageQuerySchema = z.object({});

// POST /v1/billing/purchase
router.post("/purchase", validateBody(purchaseBodySchema), purchase);

router.get("/usage", validateQuery(usageQuerySchema), usage);

export default router;
