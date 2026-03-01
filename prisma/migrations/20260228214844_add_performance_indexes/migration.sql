-- CreateIndex
CREATE INDEX "idx_api_keys_tier" ON "api_keys"("tier");

-- CreateIndex
CREATE INDEX "idx_api_keys_revoked" ON "api_keys"("revoked");

-- CreateIndex
CREATE INDEX "idx_api_keys_user_id" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "idx_quotas_daily_date" ON "api_usage_quotas_daily"("date");

-- CreateIndex
CREATE INDEX "idx_quotas_monthly_period" ON "api_usage_quotas_monthly"("year", "month");

-- CreateIndex
CREATE INDEX "idx_idempotency_expires_at" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "idx_idempotency_status" ON "idempotency_keys"("status");

-- CreateIndex
CREATE INDEX "idx_pending_tx_created_at" ON "pending_transactions"("created_at");

-- CreateIndex
CREATE INDEX "idx_pending_tx_chain_status" ON "pending_transactions"("chain_id", "status");
