import express from "express";
import * as controller from "./controller";
import { validateParams, validateQuery } from "../../core/middleware/validate";
import { chainIdParamSchema, tokensQuerySchema } from "./validation";

const router = express.Router();

// Mount at `/v1/chains` in the app; keep routes relative to the module prefix
router.get("/", controller.getChains);
router.get(
  "/:chainId/tokens",
  validateParams(chainIdParamSchema),
  validateQuery(tokensQuerySchema),
  controller.getTokens,
);
router.get(
  "/:chainId/adapters",
  validateParams(chainIdParamSchema),
  controller.getAdapters,
);

export default router;
