import express from "express";
import * as controller from "./controller";
import { validateOperation } from "../../core/middleware/openapiValidator";

const router = express.Router();

// Mount at `/v1/chains` in the app; keep routes relative to the module prefix
router.get("/", controller.getChains);
router.get(
  "/:chainId/tokens",
  validateOperation("getTokens"),
  controller.getTokens,
);
router.get(
  "/:chainId/adapters",
  validateOperation("getAdapters"),
  controller.getAdapters,
);

export default router;
