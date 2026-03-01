-- Manual migration: indexes on api_usage_logs (partitioned table, @@ignore in Prisma)
-- These indexes support all dashboard time-range, error-rate, and key-filtered queries.

-- Time-range queries: $__timeFilter(created_at) in all dashboards
CREATE INDEX IF NOT EXISTS "idx_api_usage_created_at" ON "api_usage_logs"("created_at");

-- Error rate queries: WHERE status >= 400
CREATE INDEX IF NOT EXISTS "idx_api_usage_status" ON "api_usage_logs"("status");

-- Most common dashboard query pattern: per-key + time range (partial composite)
CREATE INDEX IF NOT EXISTS "idx_api_usage_key_created" ON "api_usage_logs"("api_key_id", "created_at");

-- Endpoint breakdown queries: GROUP BY path
CREATE INDEX IF NOT EXISTS "idx_api_usage_path" ON "api_usage_logs"("path");
