/**
 * Core configuration - re-exports validated config
 */
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional(),
  FRONTEND_ORIGINS: z.string().optional(),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
  LOG_DIR: z.string().default("logs"),
});

const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(env.error.format(), null, 2),
  );
  process.exit(1);
}

export const config = env.data;
export default config;
