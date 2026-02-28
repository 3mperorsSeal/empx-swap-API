# Docker Production Readiness Audit

> **Audited by:** Senior DevOps Review  
> **Date:** March 1, 2026  
> **Verdict:** ❌ NOT production-ready — critical security issues must be resolved before any production deployment.

---

## Files Reviewed

- `Dockerfile`
- `docker-compose.yml`
- `monitoring/prometheus.yml`

---

## Summary Table

| #   | Issue                                          | Severity    | Category         |
| --- | ---------------------------------------------- | ----------- | ---------------- |
| 1   | `NODE_TLS_REJECT_UNAUTHORIZED=0` in Dockerfile | 🔴 Critical | Security         |
| 2   | Hardcoded DB & Grafana passwords               | 🔴 Critical | Security         |
| 3   | Redis has no authentication                    | 🔴 Critical | Security         |
| 4   | Adminer exposed in production                  | 🔴 Critical | Security         |
| 5   | All internal ports bound to host network       | 🟠 High     | Security         |
| 6   | No TLS / reverse proxy layer                   | 🟠 High     | Security         |
| 7   | `depends_on` without healthchecks              | 🟠 High     | Reliability      |
| 8   | No `HEALTHCHECK` in Dockerfile                 | 🟠 High     | Reliability      |
| 9   | No DB migration step on startup                | 🟠 High     | Reliability      |
| 10  | devDependencies shipped in production image    | 🟡 Medium   | Ops / Image size |
| 11  | Unpinned image tags (`latest`, `redis:7`)      | 🟡 Medium   | Reliability      |
| 12  | Prometheus scraping `/metrics` without auth    | 🟡 Medium   | Security         |
| 13  | No Alertmanager / alert rules wired up         | 🟡 Medium   | Observability    |
| 14  | No resource limits on any container            | 🟡 Medium   | Stability        |
| 15  | No log driver / rotation configured            | 🟡 Medium   | Ops              |
| 16  | `prometheus.yml` still using dev config        | 🟢 Low      | Ops              |

---

## Critical Issues

### 1. 🔴 `NODE_TLS_REJECT_UNAUTHORIZED=0` — Dockerfile

**Location:** `Dockerfile`, builder stage

```dockerfile
# CURRENT (vulnerable)
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npm install
```

This disables TLS certificate validation globally during the build. For a blockchain platform this is unacceptable — it exposes the entire build pipeline to man-in-the-middle attacks on npm registry traffic, meaning malicious packages could be silently injected.

**Fix:** Remove the flag entirely. If you have a corporate proxy causing cert issues, mount the CA certificate properly:

```dockerfile
# FIXED
COPY certs/corporate-ca.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates
RUN npm ci
```

---

### 2. 🔴 Hardcoded Plaintext Credentials — `docker-compose.yml`

**Location:** `postgres` and `grafana` services

```yaml
# CURRENT (insecure)
POSTGRES_PASSWORD: postgres
GF_SECURITY_ADMIN_PASSWORD: admin
```

Default/trivial credentials on your primary database and monitoring dashboard. The password `postgres` is the first credential any automated scanner or attacker tries.

**Fix:** Externalize all secrets via a `.env` file that is gitignored, or use Docker Secrets for Swarm/Kubernetes deployments:

```yaml
# FIXED — docker-compose.yml
postgres:
  environment:
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_DB: ${POSTGRES_DB}

grafana:
  environment:
    GF_SECURITY_ADMIN_USER: ${GF_ADMIN_USER}
    GF_SECURITY_ADMIN_PASSWORD: ${GF_ADMIN_PASSWORD}
```

```bash
# .env (gitignored — never committed)
POSTGRES_USER=empx_prod
POSTGRES_PASSWORD=<strong-random-64-char-password>
POSTGRES_DB=empxdb
GF_ADMIN_USER=empxadmin
GF_ADMIN_PASSWORD=<strong-random-64-char-password>
```

---

### 3. 🔴 Redis Has No Authentication

**Location:** `redis` service in `docker-compose.yml`

```yaml
# CURRENT (no auth)
redis:
  image: redis:7
  restart: unless-stopped
  ports:
    - "6379:6379"
```

There is zero authentication on Redis. Anyone who can reach port 6379 (and with port binding to the host, that's a wide surface) can read and write all cached data — API keys, JWT tokens, rate-limit counters, and queued blockchain transaction data. In a blockchain context, a compromised Redis means an attacker can replay or inject transaction queue entries.

**Fix:**

```yaml
# FIXED
redis:
  image: redis:7.2.4
  restart: unless-stopped
  command: >
    redis-server
    --requirepass ${REDIS_PASSWORD}
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD}
  # No host port binding — internal only
  networks:
    - dex-aggregator
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

---

### 4. 🔴 Adminer Exposed in Production

**Location:** `adminer` service in `docker-compose.yml`

```yaml
# CURRENT (critical exposure)
adminer:
  image: adminer:latest
  restart: unless-stopped
  ports:
    - "8080:8080"
```

Adminer is a full database administration UI exposed directly on port 8080 with no authentication layer beyond the database credentials themselves (which are default). This provides unrestricted SQL access to your entire database — all API keys, user data, transaction history — from the public internet.

**Fix:** Remove entirely from the production compose file. If needed for staging, restrict access to localhost only and use a non-default image tag:

```yaml
# STAGING ONLY — never in production
adminer:
  image: adminer:4.8.1
  profiles: ["dev"] # only starts with: docker compose --profile dev up
  ports:
    - "127.0.0.1:8080:8080" # localhost only
```

---

## High Severity Issues

### 5. 🟠 All Internal Service Ports Bound to Host `0.0.0.0`

**Location:** `docker-compose.yml` — `postgres`, `redis`, `prometheus` services

```yaml
# CURRENT — Postgres, Redis, Prometheus all exposed externally
ports:
  - "5432:5432" # postgres
  - "6379:6379" # redis
  - "9090:9090" # prometheus
```

These services should only be accessible within the Docker network. Binding them to the host exposes them to the server's local network and potentially the internet depending on firewall configuration.

**Fix:** Remove `ports` entries from Postgres, Redis, and Prometheus entirely. Services communicate via the `dex-aggregator` Docker network using their service names. Only the backend API port should be exposed (and ideally only to a reverse proxy, not publicly).

```yaml
# FIXED — no host port binding for internal services
postgres:
  # ports: removed — only accessible via Docker network as postgres:5432

redis:
  # ports: removed — only accessible via Docker network as redis:6379

prometheus:
  # ports: removed — access via Grafana or authenticated reverse proxy only
```

---

### 6. 🟠 No TLS / Reverse Proxy Layer

There is no Nginx, Traefik, or Caddy service. The backend is exposed raw on port 3000 with no TLS. All API key material, JWT tokens, and blockchain transaction payloads travel in plaintext over the wire.

**Fix:** Add a reverse proxy. Traefik with Let's Encrypt auto-renewal is the most operationally lightweight option for a compose-based setup:

```yaml
# Add to docker-compose.yml
traefik:
  image: traefik:v3.0
  command:
    - "--providers.docker=true"
    - "--entrypoints.websecure.address=:443"
    - "--certificatesresolvers.le.acme.tlschallenge=true"
    - "--certificatesresolvers.le.acme.email=${ACME_EMAIL}"
    - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
  ports:
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - letsencrypt:/letsencrypt
  networks:
    - dex-aggregator

backend:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.backend.rule=Host(`api.yourdomain.com`)"
    - "traefik.http.routers.backend.entrypoints=websecure"
    - "traefik.http.routers.backend.tls.certresolver=le"
```

---

### 7. 🟠 `depends_on` Without Healthchecks — Race Condition on Startup

**Location:** `backend` service in `docker-compose.yml`

```yaml
# CURRENT — only waits for container start, not service readiness
depends_on:
  - postgres
  - redis
```

Docker considers a container "started" the moment the process launches. Postgres takes several seconds to initialize its data directory on first boot. The backend will crash-loop with connection refused errors until Postgres is ready.

**Fix:**

```yaml
# FIXED
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s

redis:
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5

backend:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

---

### 8. 🟠 No `HEALTHCHECK` in Dockerfile

**Location:** `Dockerfile`, production stage

Without a `HEALTHCHECK` instruction, Docker and any orchestrator (ECS, Kubernetes, Docker Swarm) reports the container as healthy as long as the process is alive — even if Express is stuck in an infinite loop or the database connection pool is exhausted.

**Fix:**

```dockerfile
# Add to production stage in Dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"
```

Ensure your `/health` endpoint returns `200` only when the DB and Redis connections are confirmed live.

---

### 9. 🟠 No Database Migration Step on Container Startup

**Location:** `Dockerfile`, `CMD`

```dockerfile
# CURRENT — starts immediately with no migration check
CMD ["node", "dist/src/index.js"]
```

If a new migration exists (e.g., after a deployment), the app starts against a stale schema. On a blockchain platform this can corrupt transaction state silently.

**Fix:** Use an entrypoint script that runs `prisma migrate deploy` before starting the server:

```dockerfile
# Add to production stage
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/index.js"]
```

```bash
#!/bin/sh
# docker-entrypoint.sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec "$@"
```

---

## Medium Severity Issues

### 10. 🟡 devDependencies Shipped in the Production Image

**Location:** `Dockerfile`, builder stage

```dockerfile
# CURRENT — installs ALL deps including jest, ts-node, supertest etc.
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npm install

# Then copies the entire node_modules into production
COPY --from=builder /app/node_modules ./node_modules
```

The production image contains hundreds of MB of dev tooling (`jest`, `ts-node`, `ts-node-dev`, `supertest`, `node-mocks-http`, TypeScript compiler, etc.). Beyond bloat, shipping dev tools in production increases the attack surface — vulnerabilities in those packages create unnecessary CVE exposure.

**Fix:** Run two separate installs in the builder:

```dockerfile
# Build stage — install all deps for the build, then prune
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci                    # all deps for tsc / prisma generate

COPY . .
RUN npm run prisma:generate
RUN npm run build

RUN npm ci --omit=dev         # prune to production deps only

# Production stage
FROM node:20-slim AS production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules   # production-only deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/openapi.yaml ./openapi.yaml
COPY --from=builder /app/openapi ./openapi
```

---

### 11. 🟡 Unpinned / Floating Image Tags

```yaml
# CURRENT
image: postgres:15       # floats across all 15.x patch releases
image: redis:7           # floats across all 7.x releases
image: adminer:latest    # completely unpinned
```

Upstream patch releases can introduce breaking changes, new behavior, or be compromised (supply chain attacks). Pin all images to exact digest-verified versions:

```yaml
# FIXED — pin to exact patch versions
image: postgres:15.6
image: redis:7.2.4
image: prom/prometheus:v2.52.0      # already correct ✓
image: grafana/grafana:10.4.2       # already correct ✓
```

For maximum security, also pin by SHA256 digest:

```yaml
image: postgres:15.6@sha256:<digest>
```

---

### 12. 🟡 Prometheus Scrapes `/metrics` Without Authentication

**Location:** `monitoring/prometheus.yml`

```yaml
# CURRENT — bearer token auth block commented out
# authorization:
#   type: Bearer
#   credentials: <paste-your-METRICS_TOKEN-value-here>
```

The `/metrics` endpoint likely exposes internal counters, queue depths, error rates, and endpoint patterns that reveal your system's internals to anyone who can reach port 9090 or the backend directly.

**Fix:** Set `METRICS_TOKEN` in your `.env` and uncomment the authorization block. Also ensure Prometheus itself is not publicly accessible (see issue #5).

```yaml
# monitoring/prometheus.yml — FIXED
- job_name: "dex-aggregator-api"
  scrape_interval: 10s
  metrics_path: /metrics
  authorization:
    type: Bearer
    credentials_file: /etc/prometheus/metrics_token # mount as Docker secret
  static_configs:
    - targets: ["backend:3000"]
      labels:
        service: "dex-aggregator-api"
        env: "production" # was "development"
```

---

### 13. 🟡 No Alertmanager / Alert Rules Configured

**Location:** `monitoring/prometheus.yml`

```yaml
# CURRENT — fully commented out
# alerting: ...
# rule_files: ...
```

For a blockchain transaction platform, silent failures are financial failures. Without alerts you have no on-call capability.

**Minimum alert rules to add for this platform:**

| Alert                   | Condition                                             |
| ----------------------- | ----------------------------------------------------- |
| High error rate         | `rate(http_requests_total{status=~"5.."}[5m]) > 0.01` |
| Queue depth high        | Transaction queue > 1000 items for > 2 min            |
| DB connection exhausted | Pool utilization > 90%                                |
| Redis memory pressure   | Used memory > 80% of `maxmemory`                      |
| Blockchain RPC errors   | RPC call failure rate > 5%                            |
| API key auth failures   | Spike in 401s (potential key scanning)                |
| Slow requests           | P99 latency > 2s                                      |

---

### 14. 🟡 No Resource Limits on Any Container

No `mem_limit`, `cpus`, or `deploy.resources` on any service. A memory leak in the backend or a burst of blockchain transaction processing will compete with Postgres and Redis for host memory, triggering OOM kills on the wrong container.

**Fix:**

```yaml
# docker-compose.yml — add to each service
backend:
  deploy:
    resources:
      limits:
        cpus: "2.0"
        memory: 1G
      reservations:
        cpus: "0.5"
        memory: 512M

postgres:
  deploy:
    resources:
      limits:
        cpus: "2.0"
        memory: 2G

redis:
  deploy:
    resources:
      limits:
        cpus: "0.5"
        memory: 512M
```

---

### 15. 🟡 No Log Driver / Rotation Configured

Docker's default `json-file` log driver writes to disk without any size limit. On a busy blockchain API this will fill the host disk in hours, causing the entire Docker daemon to lock up.

**Fix:** Add logging configuration to every service:

```yaml
# Apply to all services in docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

For production at scale, replace with a centralized log driver:

```yaml
logging:
  driver: "loki"          # Grafana Loki
  # or
  driver: "awslogs"       # AWS CloudWatch
  # or
  driver: "fluentd"       # Fluentd / Elasticsearch
```

---

## Low Severity Issues

### 16. 🟢 `prometheus.yml` Still Configured for Dev

**Location:** `monitoring/prometheus.yml`

```yaml
# CURRENT
- targets: ["host.docker.internal:3000"] # dev host resolution
  labels:
    env: "development" # wrong for production
```

Change the scrape target to `backend:3000` (the Docker service name) and update the `env` label to `production` before deploying. The `host.docker.internal` target only works on developer machines.

---

## Additional Recommendations for a Blockchain Platform

These are not strictly about Docker/compose but are critical infrastructure concerns for a blockchain transaction platform:

1. **Secrets Management:** Use HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault for RPC provider API keys, private keys (if any), and JWT signing secrets. Do not store these in `.env` files on the production host.

2. **Network Segmentation:** Put Postgres and Redis on a separate, non-routable Docker network (`backend-db` internal network) that only the backend can reach. Prometheus/Grafana on a separate `monitoring` network.

3. **Read Replicas for Postgres:** For a high-throughput quote/swap platform, separate read traffic (quotes, history) from write traffic (transaction recording) using a read replica. `pgBouncer` is recommended as a connection pooler.

4. **Redis Persistence:** By default `redis:7` uses RDB snapshots only. For queued transaction data, enable AOF (Append Only File) persistence to prevent data loss on restart: `--appendonly yes`.

5. **Image Vulnerability Scanning:** Integrate `docker scout` or Trivy into your CI pipeline to scan images for CVEs before every prod deployment.

6. **Non-Root User Verification:** The Dockerfile correctly creates a `nodeapp` non-root user ✓. Verify the same for Prometheus and Grafana containers in production — their default images already run as non-root, but confirm this holds with your volume mounts.

7. **Separate `docker-compose.prod.yml`:** Maintain a dedicated production compose file that excludes Adminer, uses secrets instead of env vars, has no host port bindings for internal services, and includes all the hardening above. Use `docker-compose.yml` for local dev only.

---

## Prioritized Fix Order

```
Phase 1 — Before ANY production deployment (days):
  [1] Remove NODE_TLS_REJECT_UNAUTHORIZED=0
  [2] Externalize all credentials to .env / secrets
  [3] Add Redis authentication
  [4] Remove/profile-gate Adminer
  [5] Remove host port bindings from internal services
  [6] Add TLS via reverse proxy

Phase 2 — Before go-live (week):
  [7] Add healthchecks + depends_on conditions
  [8] Add HEALTHCHECK to Dockerfile
  [9] Add migration step to entrypoint
  [10] Prune devDependencies from production image
  [11] Pin all image tags

Phase 3 — Before production traffic (two weeks):
  [12] Authenticate Prometheus metrics scrape
  [13] Wire up Alertmanager + write alert rules
  [14] Add resource limits to all containers
  [15] Configure log driver and rotation
  [16] Switch prometheus.yml to backend:3000 / production labels
```
