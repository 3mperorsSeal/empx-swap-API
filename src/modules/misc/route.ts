import express from "express";
import * as controller from "./controller";
import { authMiddleware } from "../../core/middleware/auth";
import { rateLimiter } from "../../core/middleware/rateLimiter";

const router = express.Router();

router.get("/status", controller.status);
router.get("/protected", authMiddleware, rateLimiter, controller.protectedTest);

export default router;
