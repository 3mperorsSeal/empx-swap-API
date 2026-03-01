import express from "express";
import { authMiddleware } from "../../core/middleware/auth";
import { rateLimiter } from "../../core/middleware/rateLimiter";
import * as controller from "./controller";

const router = express.Router();

// Liveness: is the process alive? (no external dep checks)
router.get("/health/live", controller.liveness);

// Readiness: are all dependencies healthy? (used by load balancers)
router.get("/health/ready", controller.readiness);

// Legacy combined status endpoint
router.get("/status", controller.status);

router.get("/protected", authMiddleware, rateLimiter, controller.protectedTest);

export default router;
