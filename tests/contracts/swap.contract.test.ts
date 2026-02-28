/**
 * Swap API contract tests — assert exact response shapes.
 * These must pass after every refactor phase.
 */
import request from "supertest";
import prisma from "../../src/lib/prisma";

jest.mock("../../src/lib/prisma", () => {
  const mockPrisma = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
    api_keys: { findFirst: jest.fn() },
    partner_usage_logs: { create: jest.fn().mockResolvedValue({}) },
    tier_endpoint_configs: { findUnique: jest.fn(), aggregate: jest.fn() },
    api_usage_quotas_monthly: { findFirst: jest.fn() },
    api_usage_quotas_daily: { findFirst: jest.fn() },
    tiers: { findUnique: jest.fn() },
    endpoints: { findUnique: jest.fn() },
    idempotency_keys: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  };
});

import app from "../../src/index";

const MOCK_API_KEY = {
  id: 1,
  key_prefix: "TEST_KEY",
  tier: "pro",
  user_id: 1,
  revoked: false,
  whitelisted_ips: [],
  whitelisted_domains: [],
};

function mockQuotaPassthrough() {
  (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
    cb(prisma),
  );
  (prisma.api_usage_quotas_monthly.findFirst as jest.Mock).mockResolvedValue(
    null,
  );
  (prisma.api_usage_quotas_daily.findFirst as jest.Mock).mockResolvedValue(
    null,
  );
  (prisma.endpoints.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
  (prisma.tiers.findUnique as jest.Mock).mockResolvedValue({
    id: 1,
    name: "pro",
  });
  (prisma.tier_endpoint_configs.findUnique as jest.Mock).mockResolvedValue({
    quota: 10000,
  });
}

describe("Swap API contract", () => {
  beforeEach(() => {
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue(MOCK_API_KEY);
    mockQuotaPassthrough();
  });

  afterEach(() => jest.resetAllMocks());

  describe("POST /v1/swap/:chainId/build", () => {
    it("returns correct top-level shape", async () => {
      const res = await request(app)
        .post("/v1/swap/1/build")
        .set("x-api-key", "TEST_KEY")
        .send({
          sellToken: "ETH",
          buyToken: "DAI",
          sellAmount: "1000000000000000000",
          recipient: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        });

      expect(res.status).toBe(200);
      // Transaction object
      expect(res.body).toHaveProperty("transaction");
      expect(res.body.transaction).toHaveProperty("to");
      expect(res.body.transaction).toHaveProperty("data");
      expect(res.body.transaction).toHaveProperty("value");
      expect(res.body.transaction).toHaveProperty("gasLimit");
      expect(res.body.transaction).toHaveProperty("chainId");
      // Approval object
      expect(res.body).toHaveProperty("approval");
      expect(res.body.approval).toHaveProperty("required");
      // Meta
      expect(res.body).toHaveProperty("meta");
      expect(res.body.meta).toHaveProperty("builtAt");
      expect(res.body.meta).toHaveProperty("expiresAt");
    });

    it("returns requestId in response", async () => {
      const res = await request(app)
        .post("/v1/swap/1/build")
        .set("x-api-key", "TEST_KEY")
        .send({
          sellToken: "ETH",
          buyToken: "DAI",
          sellAmount: "1000000000000000000",
          recipient: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("requestId");
    });

    it("returns 400 when sellToken is missing", async () => {
      const res = await request(app)
        .post("/v1/swap/1/build")
        .set("x-api-key", "TEST_KEY")
        .send({
          buyToken: "DAI",
          sellAmount: "1000000000000000000",
        });

      expect(res.status).toBe(400);
    });

    it("returns 400 when sellAmount is not numeric", async () => {
      const res = await request(app)
        .post("/v1/swap/1/build")
        .set("x-api-key", "TEST_KEY")
        .send({
          sellToken: "ETH",
          buyToken: "DAI",
          sellAmount: "bad-amount",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/swap/:chainId/execute", () => {
    it("returns 400 when Idempotency-Key header is missing", async () => {
      const res = await request(app)
        .post("/v1/swap/1/execute")
        .set("x-api-key", "TEST_KEY")
        .send({
          transaction: {
            to: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            data: "0x1234",
            value: "0",
          },
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "missing_idempotency_key");
    });

    it("returns queued response with transaction_id on first call", async () => {
      (prisma.idempotency_keys.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.idempotency_keys.upsert as jest.Mock).mockResolvedValue({});
      // Mock pending_transactions create
      (prisma as any).pending_transactions = {
        create: jest.fn().mockResolvedValue({ transaction_id: "tx-123" }),
      };

      const res = await request(app)
        .post("/v1/swap/1/execute")
        .set("x-api-key", "TEST_KEY")
        .set("Idempotency-Key", "unique-key-abc")
        .send({
          transaction: {
            to: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            data: "0x1234",
            value: "0",
            gasLimit: "200000",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("transaction_id");
      expect(res.body).toHaveProperty("status", "pending");
    });

    it("returns stored response on duplicate Idempotency-Key", async () => {
      const storedResponse = {
        transaction_id: "tx-999",
        status: "pending",
        message: "Transaction queued for execution",
      };
      (prisma.idempotency_keys.findUnique as jest.Mock).mockResolvedValue({
        idempotency_key: "dup-key",
        request_hash: "hash123",
        stored_response: storedResponse,
        status: "completed",
      });

      const res = await request(app)
        .post("/v1/swap/1/execute")
        .set("x-api-key", "TEST_KEY")
        .set("Idempotency-Key", "dup-key")
        .send({
          transaction: {
            to: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            data: "0x1234",
            value: "0",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(storedResponse);
    });
  });
});
