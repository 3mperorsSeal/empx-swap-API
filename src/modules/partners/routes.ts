import express from "express";
import * as controller from "./controller";
import { sessionAuth } from "../../core/middleware/session";
import { validateBody, validateParams } from "../../core/middleware/validate";
import { z } from "zod";

const createPartnerSchema = z
  .object({
    company_name: z.string().min(1).max(255),
    website: z.string().url().max(500).nullable().optional(),
    wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  })
  .strict();

const updatePartnerSchema = z
  .object({
    company_name: z.string().min(1).max(255).optional(),
    website: z.string().url().max(500).nullable().optional(),
    wallet_address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  })
  .strict();

const partnerIdParamSchema = z.object({ id: z.string().uuid() });

const router = express.Router();

/**
 * Dashboard → Partners
 * Protected by sessionAuth
 */
router.get("/", sessionAuth, controller.listPartners);
router.get(
  "/:id",
  sessionAuth,
  validateParams(partnerIdParamSchema),
  controller.getPartner,
);
router.post(
  "/",
  sessionAuth,
  validateBody(createPartnerSchema),
  controller.createPartner,
);
router.put(
  "/:id",
  sessionAuth,
  validateParams(partnerIdParamSchema),
  validateBody(updatePartnerSchema),
  controller.updatePartner,
);
router.delete(
  "/:id",
  sessionAuth,
  validateParams(partnerIdParamSchema),
  controller.deletePartner,
);

export default router;
