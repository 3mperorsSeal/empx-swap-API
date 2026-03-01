# =============================================================================
# Multi-stage Dockerfile — production-hardened
# =============================================================================

# ---------------------------------------------------------------------------
# Build stage — install ALL deps (including devDeps for tsc), compile, then prune
# ---------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run prisma:generate
RUN npm run build

# Prune to production-only dependencies
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Production stage — minimal image with only what's needed to run
# ---------------------------------------------------------------------------
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production

# Install OpenSSL (required by Prisma at runtime)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy production-only node_modules
COPY --from=builder /app/node_modules ./node_modules

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/openapi.yaml ./openapi.yaml
COPY --from=builder /app/openapi ./openapi

# Copy Prisma schema + migrations for migrate deploy
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create logs directory and set up a non-root user with ownership
RUN groupadd -r nodeapp && useradd -r -g nodeapp nodeapp \
    && mkdir -p /app/logs \
    && chown -R nodeapp:nodeapp /app

USER nodeapp

EXPOSE 3000

# Healthcheck — verifies the /health/ready endpoint returns 200
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/ready', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/index.js"]
