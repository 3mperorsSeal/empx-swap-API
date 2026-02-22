# Codebase Analysis Report - 22 Feb 2026

## 1. File Classification

### Controllers

| Path                                  | Notes                               |
| ------------------------------------- | ----------------------------------- |
| `src/modules/auth/controller.ts`      | Auth API key generation, revoke, me |
| `src/modules/user/controller.ts`      | User register, login, me            |
| `src/modules/dashboard/controller.ts` | API keys CRUD, whitelist, usage     |
| `src/modules/chains/controller.ts`    | Chains, tokens, adapters            |
| `src/modules/quotes/controller.ts`    | Quote fast, best, batch             |
| `src/modules/swap/controller.ts`      | Swap build                          |
| `src/modules/partners/controller.ts`  | Partners CRUD                       |
| `src/modules/misc/controller.ts`      | Status, protected test              |
| `src/modules/admin/controller.ts`     | Seed DB                             |

### Services

| Path                                  | Notes                                      |
| ------------------------------------- | ------------------------------------------ |
| `src/services/apiKeyService.ts`       | API key policy, generate, store, revoke    |
| `src/services/quotaService.ts`        | Credit consumption, monthly credits, usage |
| `src/services/configService.ts`       | Tiers, endpoints, tier-endpoint config     |
| `src/services/chainService.ts`        | Chain list (static)                        |
| `src/services/chainAdapterService.ts` | Chain adapters CRUD                        |
| `src/services/quoteService.ts`        | Quote estimates via SmartRouter            |
| `src/services/swapService.ts`         | Swap transaction building                  |
| `src/modules/auth/service.ts`         | Auth wrapper over apiKeyService            |
| `src/modules/user/service.ts`         | User registration, session                 |
| `src/modules/dashboard/service.ts`    | Keys list, revoke, whitelist, usage        |
| `src/modules/partners/service.ts`     | Partners CRUD                              |
| `src/modules/chains/service.ts`       | Chains/tokens/adapters wrapper             |
| `src/modules/quotes/service.ts`       | Quote wrapper                              |
| `src/modules/swap/service.ts`         | Swap wrapper                               |
| `src/modules/billing/service.ts`      | Billing wrapper over quotaService          |

### Database Logic

| Path                                  | Notes                                            |
| ------------------------------------- | ------------------------------------------------ |
| `src/lib/prisma.ts`                   | Prisma client                                    |
| `prisma/schema.prisma`                | Schema                                           |
| `src/services/configService.ts`       | tiers, endpoints, tier_endpoint_configs          |
| `src/services/quotaService.ts`        | api_usage_quotas_monthly, api_usage_quotas_daily |
| `src/services/apiKeyService.ts`       | api_keys                                         |
| `src/services/chainAdapterService.ts` | chains, chain_adapters                           |
| `src/modules/user/service.ts`         | users                                            |
| `src/modules/partners/service.ts`     | partners                                         |
| `src/modules/dashboard/service.ts`    | api_keys, raw SQL for api_usage_logs             |
| `src/middleware/usageLogger.ts`       | api_usage_logs inserts                           |

### Middleware

| Path                                 | Notes                            |
| ------------------------------------ | -------------------------------- |
| `src/middleware/auth.ts`             | API key auth (X-API-KEY)         |
| `src/middleware/session.ts`          | JWT session auth                 |
| `src/middleware/dashboardAuth.ts`    | Dashboard secret auth            |
| `src/middleware/apiKeyGuard.ts`      | API key guard (optional)         |
| `src/middleware/rateLimiter.ts`      | Redis rate limiting              |
| `src/middleware/validate.ts`         | Zod body/query/params validation |
| `src/middleware/openapiValidator.ts` | OpenAPI operation validation     |
| `src/middleware/requestId.ts`        | Request ID                       |
| `src/middleware/requestLogger.ts`    | Request logging                  |
| `src/middleware/usageLogger.ts`      | Usage logging                    |

### Blockchain-Related Code

| Path                          | Notes                                      |
| ----------------------------- | ------------------------------------------ |
| `src/lib/smartRouter.ts`      | SmartRouter (quotes, swap encoding)        |
| `src/lib/contracts/config.ts` | Chain config, RPC URLs, contract addresses |
| `src/lib/contracts/client.ts` | Viem public client, contract instances     |
| `src/lib/contracts/abis.ts`   | EmpsealRouter, ERC20, Adapter ABIs         |
| `src/lib/contracts/types.ts`  | Solidity-like types                        |

### Utilities

| Path                | Notes                |
| ------------------- | -------------------- |
| `src/lib/logger.ts` | Winston logger       |
| `src/lib/errors.ts` | AppError             |
| `src/lib/net.ts`    | Network helpers      |
| `src/config.ts`     | Env validation (Zod) |

---

## 3. Environment Variables (Preserve All)

| Variable           | Purpose                     |
| ------------------ | --------------------------- |
| NODE_ENV           | Environment mode            |
| PORT               | Server port                 |
| DATABASE_URL       | PostgreSQL connection       |
| REDIS_URL          | Redis for rate limiting     |
| FRONTEND_ORIGINS   | CORS origins                |
| LOG_LEVEL          | Log level                   |
| LOG_DIR            | Log directory               |
| BCRYPT_ROUNDS      | Bcrypt rounds               |
| JWT_SECRET         | JWT signing                 |
| DASHBOARD_SECRET   | Dashboard auth              |
| TEST_KEY           | Test API key                |
| LOG_VERBOSE        | Verbose logging             |
| SERVICE_NAME       | Service name                |
| LOG_MAX_FILES      | Log retention               |
| LOG_CONSOLE        | Console output              |
| PULSECHAIN_RPC_URL | PulseChain RPC              |
| ETHEREUM_RPC_URL   | Ethereum RPC                |
| POLYGON_RPC_URL    | Polygon RPC                 |
| PURCHASE_CREDITS   | Default credits on purchase |
| ADMIN_EMAIL        | Admin email                 |
| ADMIN_PASSWORD     | Admin password              |

---

## 4. Key Endpoints (Swap/Quote/Transaction)

| Method | Path                        | Purpose       |
| ------ | --------------------------- | ------------- |
| GET    | `/v1/quotes/:chainId/fast`  | Fast quote    |
| GET    | `/v1/quotes/:chainId/best`  | Best quote    |
| POST   | `/v1/quotes/:chainId/batch` | Batch quotes  |
| POST   | `/v1/swap/:chainId/build`   | Build swap tx |

---

## 5. Summary

- Backend: TypeScript + Express API organized into modules (controllers → services → middleware). Prom-client metrics, OpenAPI docs, and health endpoints are present.

- Blockchain layer: `src/lib/smartRouter.ts` implements quoting and swap-building with deterministic mock fallbacks; on-chain contract integration is scaffolded under `src/lib/contracts/` and can be enabled via configuration.

- Persistence: Prisma schema models include `api_keys`, `api_usage_logs`, monthly/daily quotas, `idempotency_keys`, and `pending_transactions` (queue). Migrations and seed scripts are present (`prisma/`, `src/scripts/seed.ts`).

- Operational & Security: API key auth (`apiKeyGuard`), rate limiting (`rateLimiter`), request tracing (`requestId`), usage logging, and structured Winston logging are implemented. Environment-driven RPC and DB configs are supported.

- Features implemented: quote estimates (`/v1/quotes`), swap tx building (`/v1/swap`), partners & dashboard key management, billing/quota services, and a transaction worker scaffold (`src/infrastructure/queue/TransactionWorker.ts`).

- Testing & CI: Jest tests exist under `tests/` and test scripts are available via `npm test`. Development scripts include `dev`, `seed`, and `migrate:dev` in `package.json`.

Recommended next steps (concise):

- Enable and test real on-chain adapters by wiring RPCs and adapter addresses in `src/lib/contracts/config.ts`, then implement `SmartRouter.getRealAdapterQuotes`.
- Add integration tests that exercise end-to-end quoting and swap flows against a testnet or a mocked RPC layer.
- Harden production concerns: ensure OpenAPI validation for all public/protected routes, run migration rehearsals in staging, and add runtime alerts for DB/Redis/connectivity failures.

Overall: the codebase is mature and modular with production-oriented features already implemented; remaining work is primarily around integrating real on-chain adapters, expanding integration tests, and final operational hardening.
