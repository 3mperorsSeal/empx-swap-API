/**
 * Entry point  thin bootstrap only.
 * App creation logic lives in server.ts; server lifecycle lives in startup.ts.
 */
import logger from "./core/logger";
import { createApp } from "./server";
import { startServer } from "./startup";

const app = createApp();

if (require.main === module) {
  startServer().catch((err) => {
    try {
      logger.error("server.start_failed", {
        message: err?.message || String(err),
        code: err?.code || undefined,
        stack: err?.stack || undefined,
      });
    } catch (logErr) {
      // eslint-disable-next-line no-console
      console.error("logger.error failed", logErr);
    }
    // eslint-disable-next-line no-console
    console.error("server.start_failed", err);
    process.exit(1);
  });
}

export { createApp } from "./server";
export { startServer } from "./startup";
export default app;
