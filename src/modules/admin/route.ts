import express from "express";
import * as controller from "./controller";
import { sessionAuth, requireRole } from "../../core/middleware/session";

const router = express.Router();

// Seed DB with tiers/endpoints/adapters — admin only
router.post("/seed", sessionAuth, requireRole("admin"), controller.seed);

export default router;
