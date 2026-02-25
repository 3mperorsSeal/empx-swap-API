# DEX Aggregator API

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Node.js](https://img.shields.io/badge/node-18%2B-blue)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

A modular TypeScript + Express API for quote estimation and swap transaction building against on-chain adapters. Includes a mock-capable SmartRouter for local development, Prisma models for API keys and quotas, and scaffolding for a queue-driven transaction worker.

---

## Table of contents

- [Key features](#key-features)
- [Quick start](#quick-start)
- [Blockchain layer notes](#blockchain-layer-notes)
- [Operational checklist](#operational-checklist)
- [Maintainer & License](#maintainer--license)

---

## Key features

- Quote estimation and swap building with fallback mocks (`src/lib/smartRouter.ts`).
- Domain services in `src/services/*` (quotes, swaps, API keys, quota, chain adapters).
- HTTP controllers and routes in `src/modules/*` (`/v1/quotes`, `/v1/swap`, `/v1/billing`, `/v1/keys`, `/v1/partners`, ...).
- Prisma models and client (`src/lib/prisma.ts`, `prisma/schema.prisma`).
- Middleware: `apiKeyGuard`, `rateLimiter`, `requestId`, `requestLogger`, `usageLogger`.

## Quick start

1. Start core services (Postgres + Redis)

```bash
docker-compose up -d
```

2. Create `.env` from `.env.example`

```bash
cp .env.example .env
```

> On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

3. Install dependencies

```bash
npm install
```

4. Run development migrations

```bash
npm run migrate:dev
```

5. Seed development data

```bash
npm run seed
```

6. Start in development (hot reload)

```bash
npm run start:dev
```

7. Open Swagger docs and test endpoints

- Swagger UI: http://localhost:3000/docs
- Health: http://localhost:3000/status
- In Swagger, click **Authorize** and paste your `.env` `TEST_KEY` to call protected endpoints.

## Blockchain layer notes

- Not Implemented, uses mock data.
- Will be added once Ganadesh finalizes and guides me on what to integrate in our API

## Operational checklist

- Verify `/metrics` (Prometheus) and `/status` endpoints are reachable after deploy.
- Ensure DB and Redis credentials are stored securely in your secret manager.
- Schedule a migration rehearsal for staging; ensure `prisma migrate` fits your production strategy.
- Add integration tests that exercise quoting and swap flows using a testnet RPC or mocked `publicClient`.

## Maintainer & License

- **Maintainer:** Muhammad Talal Jami — Senior Software Engineer
  - Email: itxtalal@gmail.com
  - Website: https://mtalaljamil.me/

- **License:** Proprietary (EmpSeal)
  - Copyright (c) 2026 EmpSeal. All rights reserved.
  - This repository is private/internal to EmpSeal and is not released under an open-source license.
