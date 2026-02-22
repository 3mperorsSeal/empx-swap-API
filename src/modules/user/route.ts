import express from "express";
import * as controller from "./controller";
import { validateBody } from "../../core/middleware/validate";
import { sessionAuth } from "../../core/middleware/session";

const registerSchema = {
  type: "object",
  properties: {
    email: { type: "string" },
    name: { type: ["string", "null"] },
    password: { type: "string" },
    role: { type: "string" },
  },
  required: ["email", "password"],
  additionalProperties: false,
} as any;

const loginSchema = {
  type: "object",
  properties: { email: { type: "string" }, password: { type: "string" } },
  required: ["email", "password"],
  additionalProperties: false,
} as any;

const router = express.Router();

router.post(
  "/user/register",
  validateBody(registerSchema),
  controller.register,
);
router.post("/user/login", validateBody(loginSchema), controller.login);
router.get("/user/me", sessionAuth, controller.me);

export default router;
