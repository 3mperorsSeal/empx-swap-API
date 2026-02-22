Structured logging examples for Kibana / Elasticsearch / Datadog

Overview

- Use JSON structured logs so log aggregators (ELK, Datadog) can index fields.
- Ensure every event includes common metadata: `timestamp`, `level`, `message` (or `msg`), `service`, `env`, and `requestId` for correlation.

Recommended common fields (include when available):

- `timestamp` (ISO 8601) — logger adds this.
- `level` — error/warn/info/debug
- `message` — short human-readable message key (e.g., `auth.invalid_api_key`).
- `service` — logical service name (env: `SERVICE_NAME`).
- `env` — environment name (dev/staging/prod).
- `requestId` — request correlation id (always include if request-scoped).
- `path` / `method` / `status` / `duration_ms` — HTTP request context.
- `userId` / `apiKeyId` / `key_prefix` — identity metadata (never log secrets).
- `ip` / `host` — origin and host for request.
- `error.code` / `error.message` / `error.stack` — when logging errors use nested `error` object.
- `meta` or `extra` — free-form application context (e.g., `provider`, `txId`).

Examples (JSON lines)

1. INFO: normal request finished
   {
   "timestamp": "2026-01-14T12:34:56.789Z",
   "level": "info",
   "service": "dex-aggregator-api",
   "env": "production",
   "message": "request.complete",
   "requestId": "123e4567-e89b-12d3-a456-426614174000",
   "path": "/v1/quotes/1/quote/fast",
   "method": "GET",
   "status": 200,
   "duration_ms": 42,
   "apiKeyId": 42,
   "key_prefix": "15c6387f",
   "ip": "203.0.113.12"
   }

2. WARN: auth failure (useful to monitor brute force)
   {
   "timestamp": "2026-01-14T12:35:01.100Z",
   "level": "warn",
   "service": "dex-aggregator-api",
   "env": "production",
   "message": "auth.invalid_api_key",
   "requestId": "123e4567-e89b-12d3-a456-426614174001",
   "ip": "203.0.113.15",
   "path": "/v1/quotes/1/quote/fast",
   "method": "GET",
   "key_prefix": "unknown"
   }

3. ERROR: downstream provider failure
   {
   "timestamp": "2026-01-14T12:36:00.500Z",
   "level": "error",
   "service": "dex-aggregator-api",
   "env": "production",
   "message": "quote.provider_error",
   "requestId": "123e4567-e89b-12d3-a456-426614174002",
   "path": "/v1/quotes/1/quote/fast",
   "method": "GET",
   "status": 502,
   "duration_ms": 1200,
   "error": {
   "code": "provider_timeout",
   "message": "Provider RPC timed out",
   "stack": "...stack trace..."
   },
   "meta": { "provider": "mock", "rpc_url": "https://cloudflare-eth.com" }
   }

4. AUDIT: API key created (no raw key)
   {
   "timestamp": "2026-01-14T12:40:00.000Z",
   "level": "info",
   "service": "dex-aggregator-api",
   "env": "production",
   "message": "apikey.created",
   "requestId": "admin-cli",
   "userId": 1,
   "key_prefix": "abcd1234",
   "tier": "pro",
   "meta": { "persisted": true }
   }

Datadog / ELK best practices

- Use `requestId` to correlate app logs with traces (if using APM).
- Index `service`, `env`, `level`, `path`, `status` as keyword fields for fast aggregation.
- Avoid logging secrets; log `key_prefix` instead of full key.
- For high-volume endpoints, enable sampling (e.g., log full request/response only on errors or 1% of requests).
- Use structured `error` object so dashboards can aggregate by `error.code`.

Quick ingestion tips

- In ELK: set `message` mapping to `keyword` and `timestamp` to date; use `path` and `status` tags for dashboards.
- In Datadog: send JSON logs and use `service` and `env` tags. Use `error.code` tag to group errors.

Appendix: helper fields to include from code (example)

- When logging inside middleware or controllers include: `{ requestId: req.requestId, path: req.path, method: req.method, status: res.statusCode, duration_ms }`.
- When logging auth events include: `{ requestId, ip, key_prefix, apiKeyId, userId }`.
