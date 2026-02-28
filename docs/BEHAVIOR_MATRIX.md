# Behavior Matrix — empx-swap-API

> Last updated: 2026-03-01  
> Purpose: Single source of truth for expected API behaviour. Update this document whenever endpoint contracts change.

---

## Endpoint Inventory

| Endpoint                     | Method | Auth Required                          | Rate Limited | Quota Deducted | Idempotent              | Response Shape                                  |
| ---------------------------- | ------ | -------------------------------------- | ------------ | -------------- | ----------------------- | ----------------------------------------------- |
| `/health`                    | GET    | None                                   | No           | No             | No                      | `{ ok: true, timestamp }`                       |
| `/metrics`                   | GET    | None                                   | No           | No             | No                      | Prometheus text format                          |
| `/v1/quotes/:chainId/fast`   | GET    | apiKeyGuard                            | Yes          | Yes            | No                      | [Quote shape](#quote-response)                  |
| `/v1/quotes/:chainId/best`   | GET    | apiKeyGuard                            | Yes          | Yes            | No                      | [Quote shape](#quote-response) + `strategyUsed` |
| `/v1/quotes/:chainId/batch`  | POST   | apiKeyGuard                            | Yes          | Yes            | No                      | `{ requestId, results: QuoteResult[] }`         |
| `/v1/swap/:chainId/build`    | POST   | apiKeyGuard                            | Yes          | Yes            | No                      | [Build shape](#swap-build-response)             |
| `/v1/swap/:chainId/execute`  | POST   | apiKeyGuard                            | Yes          | Yes            | Yes (`Idempotency-Key`) | [Execute shape](#swap-execute-response)         |
| `/v1/chains`                 | GET    | apiKeyGuard                            | Yes          | Yes            | No                      | `{ requestId, chains: Chain[] }`                |
| `/v1/chains/:chainId/tokens` | GET    | apiKeyGuard                            | Yes          | Yes            | No                      | `{ requestId, total, items: Token[] }`          |
| `/v1/auth/generate`          | POST   | None                                   | No           | No             | No                      | `{ requestId, key, prefix, persisted }`         |
| `/v1/auth/revoke`            | POST   | authMiddleware                         | No           | No             | No                      | `{ requestId, revoked, prefix }`                |
| `/v1/auth/me`                | GET    | authMiddleware                         | No           | No             | No                      | `{ requestId, apiKey }`                         |
| `/v1/keys` (dashboard)       | \*     | apiKeyGuard                            | Yes          | Yes            | No                      | dashboard key management                        |
| `/v1/billing/purchase`       | POST   | apiKeyGuard                            | Yes          | No             | No                      | `{ ok, creditsGranted }`                        |
| `/v1/billing/usage`          | GET    | apiKeyGuard                            | Yes          | No             | No                      | `{ ok, usage }`                                 |
| `/v1/partners`               | GET    | apiKeyGuard + sessionAuth              | Yes          | Yes            | No                      | `{ requestId, success, data: Partner[] }`       |
| `/v1/partners`               | POST   | apiKeyGuard + sessionAuth              | Yes          | Yes            | No                      | `{ requestId, success, data: Partner }`         |
| `/v1/partners/:id`           | GET    | apiKeyGuard + sessionAuth              | Yes          | Yes            | No                      | `{ requestId, success, data: Partner }`         |
| `/v1/partners/:id`           | PUT    | apiKeyGuard + sessionAuth              | Yes          | Yes            | No                      | `{ requestId, success, data: Partner }`         |
| `/v1/partners/:id`           | DELETE | apiKeyGuard + sessionAuth              | Yes          | Yes            | No                      | `{ requestId, success }`                        |
| `/v1/admin/seed`             | POST   | apiKeyGuard + sessionAuth + admin role | Yes          | No             | No                      | `{ ok, tiers, endpoints, adapters }`            |

---

## Response Shapes

### Quote Response

```json
{
  "requestId": "uuid",
  "amountIn": "1000000000000000000",
  "amountOut": "2000000000000000000",
  "amountOutMin": "1990000000000000000",
  "priceImpact": 0.02,
  "route": {
    "type": "NOSPLIT | SPLIT | CONVERGE | WRAP | UNWRAP",
    "path": ["0x..."],
    "adapters": ["0x..."]
  },
  "meta": {
    "quotedAt": 1705000000,
    "chainId": 1,
    "computationTime": 42
  }
}
```

`/best` additionally includes `"strategyUsed": "best"`.

### Swap Build Response

```json
{
  "requestId": "uuid",
  "transaction": {
    "to": "0xRouter...",
    "data": "0x...",
    "value": "0",
    "gasLimit": "200000",
    "chainId": 1
  },
  "approval": {
    "required": true,
    "token": "0xToken...",
    "spender": "0xRouter...",
    "amount": "1000000000000000000",
    "transaction": { "to": "0xToken...", "data": "0x...", "value": "0" }
  },
  "meta": {
    "builtAt": 1705000000,
    "expiresAt": 1705000300
  }
}
```

### Swap Execute Response

```json
{
  "requestId": "uuid",
  "transaction_id": "uuid-v4",
  "status": "pending",
  "message": "Transaction queued for execution"
}
```

---

## Error Responses

All error responses follow this shape:

```json
{
  "requestId": "uuid | null",
  "error": "error_code",
  "message": "human-readable message (development only)",
  "details": {}
}
```

### Standard Error Codes

| Scenario                        | HTTP | `error` code              |
| ------------------------------- | ---- | ------------------------- |
| Missing `x-api-key` header      | 401  | `missing_api_key`         |
| Invalid / revoked API key       | 401  | `invalid_api_key`         |
| IP not in whitelist             | 403  | `ip_not_allowed`          |
| Domain not in whitelist         | 403  | `domain_not_allowed`      |
| Rate limit exceeded             | 429  | `rate_limit_exceeded`     |
| Quota exceeded                  | 429  | `quota_exceeded`          |
| Missing `Idempotency-Key`       | 400  | `missing_idempotency_key` |
| `Idempotency-Key` > 64 chars    | 400  | `invalid_idempotency_key` |
| Request body validation failure | 400  | `invalid_body`            |
| Query param validation failure  | 400  | `invalid_query`           |
| Token not found                 | 404  | `token_not_found`         |
| Chain not supported             | 404  | `chain_not_found`         |
| Invalid amount (≤ 0)            | 400  | `invalid_amount`          |

---

## Business Invariants (Must Never Change Without Review)

1. **Fee tiers**: `free = 30 bps`, `developer = 25 bps`, `pro = 20 bps`, default = `25 bps`.
2. **Default slippage**: `50 bps` (0.5%) when not provided in swap build.
3. **Idempotency TTL**: `24 hours` — duplicate `Idempotency-Key` within this window returns stored response.
4. **Quota priority**: Monthly paid credits consumed first; daily free quota consumed as fallback.
5. **API key prefix**: First 8 characters of the key are stored as `key_prefix` for fast lookup.
6. **Rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` must always be present on rate-limited routes.
7. **Quota headers**: `X-Quota-Paid-Remaining` and/or `X-Quota-Free-Remaining` present when quota is consumed.

---

## Supported Chains (Static — Phase 7 moves to DB)

| Chain ID | Name             |
| -------- | ---------------- |
| `1`      | Ethereum Mainnet |
| `137`    | Polygon          |

## Supported Native Tokens

`ETH`, `PLS`, `MATIC`, `PULSE` — these are resolved as lowercase identifiers rather than addresses.

---

## Rate Limit Tiers (Token Bucket)

| Tier        | RPM   | Burst |
| ----------- | ----- | ----- |
| `anonymous` | 10    | 20    |
| `free`      | 100   | 150   |
| `developer` | 1000  | 1500  |
| `pro`       | 10000 | 15000 |
