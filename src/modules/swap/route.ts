import express from "express";
import * as controller from "./controller";
import { validateParams, validateBody } from "../../core/middleware/validate";
import {
  chainIdParamSchema,
  swapBuildSchema,
  swapExecuteSchema,
} from "./validation";
import {
  requireIdempotencyKey,
  checkIdempotency,
} from "../../core/middleware/idempotency";

const router = express.Router();

router.post(
  "/:chainId/build",
  validateParams(chainIdParamSchema),
  validateBody(swapBuildSchema),
  controller.swapBuild,
);

router.post(
  "/:chainId/execute",
  requireIdempotencyKey,
  checkIdempotency,
  validateParams(chainIdParamSchema),
  validateBody(swapExecuteSchema),
  controller.swapExecute,
);

export default router;
