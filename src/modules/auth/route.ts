import express from "express";
import * as controller from "./controller";
import { authMiddleware } from "../../core/middleware/auth";
import { validateBody } from "../../core/middleware/validate";

import { z } from "zod";

const generateSchema = z.object({
  userId: z.number().nullable().optional(),
  tier: z.string().optional(),
  persist: z.boolean().optional(),
});

const revokeSchema = z.object({
  prefix: z.string().min(1, "Prefix is required"),
});

const router = express.Router();

router.post("/generate", validateBody(generateSchema), controller.generateKey);
router.post(
  "/revoke",
  authMiddleware,
  validateBody(revokeSchema),
  controller.revokeKey,
);
router.get("/me", authMiddleware, controller.me);

export default router;
