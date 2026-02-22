# DEX Aggregator API

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Node.js](https://img.shields.io/badge/node-18%2B-blue)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

A modular TypeScript + Express API for quote estimation and swap transaction building against on-chain adapters. Includes a mock-capable SmartRouter for local development, Prisma models for API keys and quotas, and scaffolding for a queue-driven transaction worker.

---

## Table of contents

- [Key features](#key-features)
- [Quick start](#quick-start)
- [Environment](#environment)
- [Scripts](#scripts)
- [Blockchain layer notes](#blockchain-layer-notes)
- [Deployment](#deployment)
- [Operational checklist](#operational-checklist)
- [Contributing](#contributing)
- [Maintainer & License](#maintainer--license)

---

## Key features

- Quote estimation and swap building with fallback mocks (`src/lib/smartRouter.ts`).
- Domain services in `src/services/*` (quotes, swaps, API keys, quota, chain adapters).
- HTTP controllers and routes in `src/modules/*` (`/v1/quotes`, `/v1/swap`, `/v1/billing`, `/v1/keys`, `/v1/partners`, ...).
- Prisma models and client (`src/lib/prisma.ts`, `prisma/schema.prisma`).
- Middleware: `apiKeyGuard`, `rateLimiter`, `requestId`, `requestLogger`, `usageLogger`.

## Quick start

1. Install dependencies

```bash
npm install
```

2. Start in development (hot reload)

```bash
npm run start:dev
```

3. Useful endpoints

- Swagger UI: http://localhost:3000/docs
- Health: http://localhost:3000/status

## Environment

Required environment variables:

- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string (for rate limiter)
- `JWT_SECRET` — JWT signing secret
- `DASHBOARD_SECRET` — dashboard admin secret
- `TEST_KEY` — optional: development API key
- RPC endpoints (for real adapters): `ETHEREUM_RPC_URL`, `PULSECHAIN_RPC_URL`, `POLYGON_RPC_URL`, etc.

## Scripts

Run common tasks with npm:

```bash
# development
npm run start:dev

# build and production
npm run build
npm run start:prod

# tests
npm run test

# prisma
npm run prisma:generate
npm run prisma:studio
npm run migrate

# seed and worker
npm run seed
npm run worker
```

## Blockchain layer notes

- The SmartRouter supports two modes:
  - Mock fallback: used when RPCs/contracts are not configured (local dev / tests).
  - Real mode: enabled when `src/lib/contracts/config.ts` contains valid RPC URLs and adapter contract addresses.
- To enable on-chain routing in production, configure RPC URLs and seed adapter entries in the DB or implement adapter discovery.

## Deployment

Recommended CI/CD steps:

```bash
# install deps
npm ci

# generate prisma client
npm run prisma:generate

# apply migrations (run in staging/production as appropriate)
npm run migrate

# build and start
npm run build
npm run start:prod
```

## Operational checklist

- Verify `/metrics` (Prometheus) and `/status` endpoints are reachable after deploy.
- Ensure DB and Redis credentials are stored securely in your secret manager.
- Schedule a migration rehearsal for staging; ensure `prisma migrate` fits your production strategy.
- Add integration tests that exercise quoting and swap flows using a testnet RPC or mocked `publicClient`.

## Contributing

- Run unit tests: `npm run test`
- Format code: `npm run format`
- Open a PR with clear description and update `docs/PHASE1_ANALYSIS_REPORT.md` if you change architecture or risk areas.

## Maintainer & License

- **Maintainer:** Muhammad Talal Jami — Senior Software Engineer
  - Email: itxtalal@gmail.com
  - Website: https://mtalaljamil.me/

- **License:** Proprietary (EmpSeal)
  - Copyright (c) 2026 EmpSeal. All rights reserved.
  - This repository is private/internal to EmpSeal and is not released under an open-source license.
