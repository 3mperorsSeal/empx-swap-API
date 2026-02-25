# EMPX Swap API

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Node.js](https://img.shields.io/badge/node-18%2B-blue)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

Production-oriented TypeScript + Express API for chain discovery, quote estimation, swap transaction building, API-key governance, usage metering, and billing foundations.

## Table of Contents

- [1) What this repository is](#1-what-this-repository-is)
- [2) Tech stack](#2-tech-stack)
- [3) High-level architecture](#3-high-level-architecture)
- [4) Prerequisites](#4-prerequisites)
- [5) First-time setup (new developer)](#5-first-time-setup-new-developer)
- [6) Daily development workflow](#6-daily-development-workflow)
- [7) Environment variables](#7-environment-variables)
- [8) API docs and health endpoints](#8-api-docs-and-health-endpoints)
- [9) Common commands](#9-common-commands)
- [10) Logging, metrics, and observability](#10-logging-metrics-and-observability)
- [11) Database and Prisma notes](#11-database-and-prisma-notes)
- [12) Troubleshooting](#12-troubleshooting)
- [13) Maintainer and license](#14-maintainer-and-license)

## 1) What this repository is

This service is the backend API layer for EMPX swap workflows.

Core capabilities:
- Auth and user access flows
- API key issuance/validation and quota control
- Chain/token metadata serving
- Quote and swap transaction orchestration
- Partner/admin/billing route surface
- OpenAPI-based documentation and request validation support

Current blockchain execution status:
- Quote/swap paths are development-ready with mock-capable routing logic.
- Full production on-chain execution adapter work is scaffolded and can be wired to provider-specific signing/broadcast flows.

## 2) Tech stack

- Runtime: Node.js, TypeScript, Express
- Data: PostgreSQL + Prisma ORM
- Cache/infra: Redis
- Validation: Zod + AJV/OpenAPI validators
- Docs: Swagger UI + OpenAPI YAML
- Observability: Winston structured logs + Prometheus metrics
- Testing: Jest + Supertest

## 3) High-level architecture

Primary folders:
- `src/core`: config, logger, shared errors, middleware
- `src/modules`: feature-first route/controller/service layers
- `src/infrastructure`: blockchain/cache/db/queue integrations
- `src/lib`: shared adapters/utilities (`prisma`, smart-router, contracts)
- `src/scripts`: operational scripts (seeding, setup helpers)
- `prisma`: schema + migrations
- `openapi`: split OpenAPI modules
- `docs`: architecture and operational notes

Reference docs:
- `docs/ENTERPRISE_ARCHITECTURE.md`
- `docs/LOGGING.md`
- `docs/ANALYSIS_REPORT_22_Feb.md`

## 4) Prerequisites

Install before starting:
- Node.js 18+ (Node 20 LTS recommended)
- npm 9+
- Docker Desktop (for PostgreSQL/Redis via Compose)

Recommended tooling:
- VS Code with TypeScript + Prisma extensions
- Postman or Swagger UI for endpoint testing

## 5) First-time setup (new developer)

### Step 1: Clone and enter project

```bash
git clone https://github.com/3mperorsSeal/empx-swap-API
cd empx-swap-API
```

### Step 2: Create environment file

macOS/Linux:
```bash
cp .env.example .env
```

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

### Step 3: Start local infrastructure

```bash
docker-compose up -d
```

Services started:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- Adminer on `localhost:8080`

### Step 4: Install dependencies

```bash
npm install
```

### Step 5: Apply Prisma migrations

```bash
npm run migrate:dev
```

### Step 6: Seed local development data

```bash
npm run seed
```

This seeds users, tiers, endpoints, chain/token data, adapters, and local test data used by protected routes.

### Step 7: Run API in development mode

```bash
npm run start:dev
```

By default, server runs on `http://localhost:3000`.

## 6) Daily development workflow

1. Pull latest changes from default branch.
2. Re-run migrations if schema changed: `npm run migrate:dev`.
3. Re-seed when seed data changes: `npm run seed`.
4. Start service: `npm run start:dev`.
5. Run tests before opening PR: `npm test`.
6. Validate TypeScript before merge: `npm run typecheck`.

## 7) Environment variables

Use `.env.example` as the canonical template.

Minimum required keys:
- `NODE_ENV`
- `PORT`
- `DATABASE_URL`

Common development keys:
- `REDIS_URL`
- `FRONTEND_ORIGINS`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `TEST_KEY`
- `LOG_LEVEL`
- `LOG_DIR`
- `SERVICE_NAME`

Security guidance:
- Never commit `.env`.
- Rotate all non-dev secrets in shared/staging/production environments.
- Use a secrets manager in non-local environments.

## 8) API docs and health endpoints

After service start:
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- OpenAPI YAML: `http://localhost:3000/openapi.yaml`
- Health: `http://localhost:3000/status`
- Metrics: `http://localhost:3000/metrics`

Protected routes require API key authentication (`X-API-KEY`).

## 9) Common commands

```bash
# development
npm run start:dev

# build + production start
npm run build
npm run start:prod

# tests
npm test

# static checks
npm run typecheck

# prisma
npm run prisma:generate
npm run migrate:dev
npm run migrate
npm run prisma:studio

# seed
npm run seed
```

## 10) Logging, metrics, and observability

- Logs are structured and written by Winston.
- Default log directory is controlled by `LOG_DIR` (default: `logs`).
- Prometheus metrics are exposed at `/metrics`.
- Request-level correlation is available through request IDs and middleware logging.

For log field standards and ingestion examples, see `docs/LOGGING.md`.

## 11) Database and Prisma notes

- Prisma schema: `prisma/schema.prisma`
- Generated client: `generated/prisma`
- Migrations: `prisma/migrations`

Local reset strategy (development only):
1. Stop API.
2. Reset DB container volume if needed.
3. Re-run `npm run migrate:dev` and `npm run seed`.

Production strategy:
- Use `npm run migrate` (`prisma migrate deploy`) in CI/CD.
- Do not run destructive resets in production.

## 12) Troubleshooting

### App fails on startup (`Invalid environment variables`)
- Ensure `.env` exists and `DATABASE_URL` is valid.
- Confirm required variables match `.env.example`.

### Port already in use
- Update `PORT` in `.env` or stop conflicting process.

### Database connection errors
- Confirm Docker services are running: `docker-compose ps`.
- Verify PostgreSQL is reachable on `localhost:5432`.

### Missing Prisma client/types
- Run `npm run prisma:generate`.

### Failing protected endpoint requests
- Provide valid `X-API-KEY`.
- Confirm key is not revoked and has quota/rate allowance.

## 13) Maintainer and license

Maintainer:
- Muhammad Talal Jami — Senior Software Engineer
- Email: `itxtalal@gmail.com`
- Website: `https://mtalaljamil.me/`

License:
- Proprietary (EmpSeal)
- Copyright (c) 2026 EmpSeal. All rights reserved.
- Internal/private repository; not distributed as open source.
