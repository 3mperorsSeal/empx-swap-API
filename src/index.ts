// Libraries
import compression from "compression";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import http from "http";
import path from "path";
import { collectDefaultMetrics, register } from "prom-client";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

// Config
import config from "./core/config";

// Helpers & Libs
import { isAppError } from "./core/errors";
import logger from "./core/logger";
import { prisma } from "./lib/prisma";

// Middleware
import { apiKeyGuard } from "./core/middleware/apiKeyGuard";
import { rateLimiter } from "./core/middleware/rateLimiter";
import requestIdMiddleware from "./core/middleware/requestId";
import requestLogger from "./core/middleware/requestLogger";
import { usageLogger } from "./core/middleware/usageLogger";

// Modules & Routes
import adminRoutes from "./modules/admin/route";
import authRoutes from "./modules/auth/route";
import billingRoutes from "./modules/billing/route";
import chainsRoutes from "./modules/chains/route";
import dashboardRoutes from "./modules/dashboard/route";
import miscRoutes from "./modules/misc/route";
import partnersRoutes from "./modules/partners/routes";
import quotesRoutes from "./modules/quotes/route";
import swapRoutes from "./modules/swap/route";
import userRoutes from "./modules/user/route";

const port = Number(config.PORT) || 3000;

const allowedOrigins = (config.FRONTEND_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const swaggerUiOptions = {
  customSiteTitle: "DEX Aggregator API Documentation",
  customfavIcon: "/favicon.ico",
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

function setupMiddlewares(app: express.Express) {
  app.set("trust proxy", true);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-API-KEY"],
    }),
  );

  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(usageLogger);
}

function setupSwagger(app: express.Express) {
  // Try to load the OpenAPI document once so we can serve JSON/YAML directly
  let swaggerDocument: any = {};
  try {
    swaggerDocument = YAML.load(path.join(__dirname, "..", "openapi.yaml"));
  } catch (err) {
    logger.warn("swagger.load_failed", { err });
  }

  const openapiDir = path.join(__dirname, "..", "openapi");
  app.use("/openapi", express.static(openapiDir));
  app.get("/openapi.json", (req, res) => res.json(swaggerDocument));
  app.get("/openapi.yaml", (req, res) => {
    res.type("text/yaml");
    res.send(YAML.stringify(swaggerDocument, 10));
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      ...swaggerUiOptions,
      swaggerUrl: "/openapi.yaml",
    }),
  );
  app.get("/docs", (req, res) => res.redirect(302, "/api-docs"));
}

function setupRoutes(app: express.Express) {
  // PROTECTED ROUTES
  app.use("/api", apiKeyGuard);
  app.get("/api/test", (req, res) => {
    res.json({ message: "Hello, your API key passed!" });
  });

  // Health & Metrics
  try {
    collectDefaultMetrics();
  } catch (err: any) {
    // prom-client throws when metrics are registered twice (e.g. during hot reloads).
    // Ignore duplicate-registration errors but surface others.
    const msg = err?.message || String(err);
    if (msg.includes("has already been registered")) {
      logger.warn("metrics.already_registered", { message: msg });
    } else {
      logger.error("metrics.init_failed", { err });
      throw err;
    }
  }
  app.get("/metrics", async (req, res) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (ex) {
      res.status(500).end(String(ex));
    }
  });

  // Public & Health
  app.use("/", miscRoutes);

  // Auth & User (Protected by their own middleware where needed)
  app.use("/v1/auth", authRoutes);
  app.use("/v1/auth", userRoutes);

  // PROTECTED API V1 ROUTES (Data & Billing) - with enterprise usage logging
  app.use("/v1/chains", apiKeyGuard, usageLogger, rateLimiter, chainsRoutes);
  app.use("/v1/quotes", apiKeyGuard, usageLogger, rateLimiter, quotesRoutes);
  app.use("/v1/swap", apiKeyGuard, usageLogger, rateLimiter, swapRoutes);
  app.use("/v1/keys", apiKeyGuard, usageLogger, rateLimiter, dashboardRoutes);
  app.use(
    "/v1/partners",
    apiKeyGuard,
    usageLogger,
    rateLimiter,
    partnersRoutes,
  );
  app.use("/v1/admin", apiKeyGuard, usageLogger, rateLimiter, adminRoutes);
  app.use("/v1/billing", apiKeyGuard, usageLogger, rateLimiter, billingRoutes);
}

function setupErrorHandler(app: express.Express) {
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const rid = req.requestId || null;

    const requestMeta = {
      requestId: rid,
      path: req.path,
      method: req.method,
      ip: req.ip,
      apiKeyId: req.apiKey?.id || null,
      userId: req.apiKey?.user_id || null,
    };

    // 1. Log the full error for internal tracking
    if (isAppError(err) && err.status < 500) {
      logger.warn("app.error", {
        ...requestMeta,
        code: err.code,
        details: err.details,
      });
    } else {
      logger.error("unhandled.error", {
        ...requestMeta,
        message: err?.message,
        stack: err?.stack,
      });
    }

    // 2. Prevent sending multiple responses
    if (res.headersSent) {
      return next(err);
    }

    // 3. Send standardized JSON response
    if (isAppError(err)) {
      return res.status(err.status).json({
        requestId: rid,
        error: err.code,
        message: config.NODE_ENV === "development" ? err.message : undefined,
        details: err.details,
      });
    }

    // Fallback for unexpected errors
    res.status(500).json({
      requestId: rid,
      error: "internal_server_error",
      message:
        config.NODE_ENV === "development"
          ? err?.message
          : "An unexpected error occurred",
    });
  });
}

export function createApp() {
  const app = express();
  setupMiddlewares(app);
  setupSwagger(app);
  setupRoutes(app);
  setupErrorHandler(app);
  return app;
}

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

const app = createApp();

if (require.main === module) {
  // only start the server when run directly
  // Delay start to allow diagnostics or instrumentation to attach in some environments
  startServer().catch((err) => {
    // Log structured error fields so the logger doesn't drop details
    try {
      logger.error("server.start_failed", {
        message: err?.message || String(err),
        code: err?.code || undefined,
        stack: err?.stack || undefined,
      });
    } catch (logErr) {
      // Fallback to console if logger fails
      // eslint-disable-next-line no-console
      console.error("logger.error failed", logErr);
    }

    // Always print to console during development so ts-node-dev captures it
    // eslint-disable-next-line no-console
    console.error("server.start_failed", err);
    process.exit(1);
  });
}

export default app;
