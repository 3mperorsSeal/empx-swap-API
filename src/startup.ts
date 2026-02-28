import http from "http";
import config from "./core/config";
import logger from "./core/logger";
import { prisma } from "./lib/prisma";
import { createApp } from "./server";

const port = Number(config.PORT) || 3000;

let server: http.Server | null = null;

export async function startServer() {
  const app = createApp();
  const portNum = port;

  // Start server and wait for listen or error
  await new Promise<void>((resolve, reject) => {
    try {
      server = http.createServer(app);
      server!.on("error", (err: any) => {
        // Surface listen errors explicitly
        logger.error("server.listen_error_internal", { err });
        if (err && err.code === "EADDRINUSE") {
          logger.error("server.listen_eaddrinuse", {
            code: err.code,
            port: portNum,
          });
        }
        reject(err);
      });

      server!.listen(portNum, () => {
        logger.info("server.start", { port: portNum });
        resolve();
      });
    } catch (err) {
      // Synchronous errors
      logger.error("server.listen_sync_error", { err });
      reject(err);
    }
  });

  const shutdown = async (signal: string) => {
    if (!server) return;
    logger.info("server.shutdown", { signal });
    let closed = false;
    server.close(async (closeErr?: Error) => {
      closed = true;
      logger.info("server.connections_closed");
      try {
        await prisma.$disconnect();
        logger.info("prisma.disconnected");
        process.exit(0);
      } catch (err) {
        logger.error("server.shutdown_error", { err });
        process.exit(1);
      }
    });

    setTimeout(() => {
      if (!closed) {
        logger.error("server.shutdown_force_exit");
        process.exit(1);
      }
    }, 10000);
  };

  process.once("SIGUSR2", async () => {
    await shutdown("SIGUSR2");
    process.kill(process.pid, "SIGUSR2");
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled.rejection", { reason });
    shutdown("unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    logger.error("uncaught.exception", { err });
    shutdown("uncaughtException");
  });
}
