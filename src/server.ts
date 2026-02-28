// Libraries
import compression from "compression";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import path from "path";
import { metricsRegistry, initDefaultMetrics } from "./core/metrics";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

// Config
import config from "./core/config";

// Helpers & Libs
import { isAppError } from "./core/errors";
import logger from "./core/logger";

// Middleware
import { apiKeyGuard } from "./core/middleware/apiKeyGuard";
import { createRateLimiter } from "./core/middleware/rateLimiter";
import requestIdMiddleware from "./core/middleware/requestId";
import requestLogger from "./core/middleware/requestLogger";
import { usageLogger } from "./core/middleware/usageLogger";
import { createRedisClient } from "./infrastructure/cache/redis";

const redisClient = createRedisClient(process.env.REDIS_URL);
const rateLimiter = createRateLimiter(redisClient);

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

const allowedOrigins = (config.FRONTEND_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const swaggerUiOptions = {
  customSiteTitle: "EMPX Swap · API Documentation",
  customfavIcon: "/favicon.ico",
  explorer: true,
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar .download-url-wrapper .select-label { color: #e0e0e0; }
    .swagger-ui .info .title { font-size: 2.2em; }
    .swagger-ui .info .description p { font-size: 14px; line-height: 1.6; }
    .swagger-ui .opblock.opblock-get    .opblock-summary-method { background: #61affe; }
    .swagger-ui .opblock.opblock-post   .opblock-summary-method { background: #49cc90; }
    .swagger-ui .opblock.opblock-put    .opblock-summary-method { background: #fca130; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #f93e3e; }
    .swagger-ui .opblock.opblock-patch  .opblock-summary-method { background: #50e3c2; }
    .swagger-ui .opblock .opblock-summary-description { font-style: italic; }
    .swagger-ui .btn.execute { background-color: #4990e2; border-color: #4990e2; }
    .swagger-ui .btn.execute:hover { background-color: #357abd; }
    .swagger-ui section.models { border: 1px solid #e0e0e0; border-radius: 6px; }
    .swagger-ui .model-box { background: #fafafa; }
    .swagger-ui .response-col_status { font-weight: 700; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    docExpansion: "list",
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    tagsSorter: "alpha",
    operationsSorter: "alpha",
    syntaxHighlight: { activate: true, theme: "monokai" },
    requestSnippetsEnabled: true,
    displayOperationId: true,
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
  initDefaultMetrics();

  app.get("/metrics", async (req, res) => {
    // Optionally protect with a bearer token configured via METRICS_TOKEN.
    const metricsToken = config.METRICS_TOKEN;
    if (metricsToken) {
      const auth = req.headers["authorization"] || "";
      const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (provided !== metricsToken) {
        res.status(401).set("WWW-Authenticate", 'Bearer realm="metrics"').end();
        return;
      }
    }
    try {
      res.set("Content-Type", metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
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
