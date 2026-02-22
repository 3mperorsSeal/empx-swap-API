import express from "express";
import * as controller from "./controller";
import { sessionAuth } from "../../core/middleware/session";
import { validateBody, validateParams } from "../../core/middleware/validate";
import { z } from "zod";

const createSchema = z
  .object({
    userId: z.number().nullable().optional(),
    tier: z.string().optional(),
    persist: z.boolean().optional(),
  })
  .strict();

const revokeSchema = z.object({
  prefix: z.string().min(1, "Prefix is required"),
});

const prefixParamSchema = z.object({
  prefix: z.string().min(1, "Prefix is required"),
});

const whitelistPatchSchema = z
  .object({
    whitelisted_ips: z.array(z.string()).optional(),
    whitelisted_domains: z.array(z.string()).optional(),
  })
  .strict();

const router = express.Router();

// Dashboard routes are protected by sessionAuth (JWT sessions)
router.get("/", sessionAuth, controller.listKeys);
router.post("/", sessionAuth, validateBody(createSchema), controller.createKey);
router.post(
  "/revoke",
  sessionAuth,
  validateBody(revokeSchema),
  controller.revokeKey,
);
router.patch(
  "/:prefix/whitelist",
  sessionAuth,
  validateParams(prefixParamSchema),
  validateBody(whitelistPatchSchema),
  controller.patchWhitelist,
);
router.get(
  "/:prefix/usage",
  sessionAuth,
  validateParams(prefixParamSchema),
  controller.getUsage,
);

export default router;
