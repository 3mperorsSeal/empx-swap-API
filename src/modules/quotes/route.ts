import express from "express";
import * as controller from "./controller";
import {
  validateParams,
  validateQuery,
  validateBody,
} from "../../core/middleware/validate";
import {
  chainIdParamSchema,
  quoteQuerySchema,
  quoteBatchSchema,
} from "./validation";

const router = express.Router();

router.get(
  "/:chainId/fast",
  validateParams(chainIdParamSchema),
  validateQuery(quoteQuerySchema),
  controller.quoteFast,
);

router.get(
  "/:chainId/best",
  validateParams(chainIdParamSchema),
  validateQuery(quoteQuerySchema),
  controller.quoteBest,
);

router.post(
  "/:chainId/batch",
  validateParams(chainIdParamSchema),
  validateBody(quoteBatchSchema),
  controller.quoteBatch,
);

export default router;
