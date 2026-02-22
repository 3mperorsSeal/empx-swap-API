-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "key_prefix" VARCHAR(32) NOT NULL,
    "key_hash" TEXT NOT NULL,
    "user_id" INTEGER,
    "tier" VARCHAR(32) NOT NULL DEFAULT 'free',
    "whitelisted_ips" JSONB DEFAULT '[]',
    "whitelisted_domains" JSONB DEFAULT '[]',
    "revoked" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" BIGSERIAL NOT NULL,
    "api_key_id" INTEGER,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "cost" INTEGER DEFAULT 1,
    "ip" INET,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id","created_at")
);

-- CreateTable
CREATE TABLE "chain_adapters" (
    "id" SERIAL NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "adapter_name" TEXT NOT NULL,
    "max_rpc_per_min" INTEGER DEFAULT 0,
    "fee_per_call" DECIMAL(18,8) DEFAULT 0,
    "priority" INTEGER DEFAULT 100,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_adapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chains" (
    "id" SERIAL NOT NULL,
    "chain_id" VARCHAR(64) NOT NULL,
    "name" TEXT,
    "rpc_urls" JSONB DEFAULT '[]',
    "native_currency" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "decimals" INTEGER,
    "coingecko_id" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_tokens" (
    "id" SERIAL NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "token_id" INTEGER,
    "token_address" VARCHAR(255) NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endpoints" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_endpoint_configs" (
    "id" SERIAL NOT NULL,
    "tier_id" INTEGER NOT NULL,
    "endpoint_id" INTEGER NOT NULL,
    "rate_limit" INTEGER DEFAULT 0,
    "quota" INTEGER DEFAULT 0,
    "price_per_request" DECIMAL(18,8) DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tier_endpoint_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "features" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_name" TEXT NOT NULL,
    "website" TEXT,
    "wallet_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "role" VARCHAR(32) DEFAULT 'user',
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_quotas_monthly" (
    "id" SERIAL NOT NULL,
    "api_key_id" INTEGER,
    "user_id" INTEGER,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "purchased_credits" INTEGER NOT NULL DEFAULT 0,
    "used_credits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_usage_quotas_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_quotas_daily" (
    "id" SERIAL NOT NULL,
    "api_key_id" INTEGER,
    "user_id" INTEGER,
    "date" DATE NOT NULL,
    "used_credits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_quotas_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" SERIAL NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "request_hash" VARCHAR(64),
    "stored_response" JSONB,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_transactions" (
    "id" SERIAL NOT NULL,
    "transaction_id" VARCHAR(64) NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "tx_hash" VARCHAR(66),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "pending_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_usage_logs" (
    "id" SERIAL NOT NULL,
    "api_key_id" INTEGER,
    "endpoint" VARCHAR(255) NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "status" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_prefix_key" ON "api_keys"("key_prefix");

-- CreateIndex
CREATE INDEX "idx_api_keys_prefix" ON "api_keys"("key_prefix");

-- CreateIndex
CREATE INDEX "idx_api_usage_api_key" ON "api_usage_logs"("api_key_id");

-- CreateIndex
CREATE INDEX "idx_api_usage_request_id" ON "api_usage_logs"("request_id");

-- CreateIndex
CREATE INDEX "idx_chain_adapters_chain" ON "chain_adapters"("chain_id");

-- CreateIndex
CREATE INDEX "idx_chain_adapters_priority" ON "chain_adapters"("chain_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "chain_adapters_chain_id_adapter_name_key" ON "chain_adapters"("chain_id", "adapter_name");

-- CreateIndex
CREATE UNIQUE INDEX "chains_chain_id_key" ON "chains"("chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_symbol_coingecko_id_key" ON "tokens"("symbol", "coingecko_id");

-- CreateIndex
CREATE INDEX "idx_chain_tokens_chain" ON "chain_tokens"("chain_id");

-- CreateIndex
CREATE INDEX "idx_chain_tokens_token" ON "chain_tokens"("token_id");

-- CreateIndex
CREATE UNIQUE INDEX "chain_tokens_chain_id_token_address_key" ON "chain_tokens"("chain_id", "token_address");

-- CreateIndex
CREATE UNIQUE INDEX "endpoints_path_method_key" ON "endpoints"("path", "method");

-- CreateIndex
CREATE INDEX "idx_tier_endpoint_endpoint" ON "tier_endpoint_configs"("endpoint_id");

-- CreateIndex
CREATE INDEX "idx_tier_endpoint_tier" ON "tier_endpoint_configs"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "tier_endpoint_configs_tier_id_endpoint_id_key" ON "tier_endpoint_configs"("tier_id", "endpoint_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiers_name_key" ON "tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "partners_wallet_address_key" ON "partners"("wallet_address");

-- CreateIndex
CREATE INDEX "idx_partners_company_name" ON "partners"("company_name");

-- CreateIndex
CREATE INDEX "idx_partners_created_at" ON "partners"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_quotas_monthly_api_key_id_year_month_key" ON "api_usage_quotas_monthly"("api_key_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_quotas_daily_api_key_id_date_key" ON "api_usage_quotas_daily"("api_key_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_idempotency_key_key" ON "idempotency_keys"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_idempotency_key" ON "idempotency_keys"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "pending_transactions_transaction_id_key" ON "pending_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_pending_tx_status" ON "pending_transactions"("status");

-- CreateIndex
CREATE INDEX "idx_partner_usage_key" ON "partner_usage_logs"("api_key_id");

-- CreateIndex
CREATE INDEX "idx_partner_usage_created" ON "partner_usage_logs"("created_at");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chain_adapters" ADD CONSTRAINT "chain_adapters_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chain_tokens" ADD CONSTRAINT "chain_tokens_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chain_tokens" ADD CONSTRAINT "chain_tokens_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tier_endpoint_configs" ADD CONSTRAINT "tier_endpoint_configs_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tier_endpoint_configs" ADD CONSTRAINT "tier_endpoint_configs_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
