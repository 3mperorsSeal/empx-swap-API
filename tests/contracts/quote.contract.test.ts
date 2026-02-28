/**
 * Quote API contract tests — assert exact response shapes.
 * These must pass after every refactor phase.
 */
import request from "supertest";
import prisma from "../../src/lib/prisma";

jest.mock("../../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
    api_keys: { findFirst: jest.fn() },
    partner_usage_logs: { create: jest.fn().mockResolvedValue({}) },
    tier_endpoint_configs: { findUnique: jest.fn(), aggregate: jest.fn() },
    api_usage_quotas_monthly: { findFirst: jest.fn() },
    api_usage_quotas_daily: { findFirst: jest.fn() },
    tiers: { findUnique: jest.fn() },
    endpoints: { findUnique: jest.fn() },
    chains: { findUnique: jest.fn() },
    chain_tokens: { findFirst: jest.fn() },
  },
}));

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

describe("Quote API contract", () => {
  beforeEach(() => {
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue(MOCK_API_KEY);
    mockQuotaPassthrough();
  });

  afterEach(() => jest.resetAllMocks());

  describe("GET /v1/quotes/:chainId/fast", () => {
    it("returns correct top-level shape", async () => {
      const res = await request(app)
        .get("/v1/quotes/1/fast")
        .set("x-api-key", "TEST_KEY")
        .query({
          sellToken: "ETH",
          buyToken: "DAI",
          sellAmount: "1000000000000000000",
        });

      expect(res.status).toBe(200);
      // Core quote fields
      expect(res.body).toHaveProperty("amountIn");
      expect(res.body).toHaveProperty("amountOut");
      expect(res.body).toHaveProperty("amountOutMin");
      expect(res.body).toHaveProperty("priceImpact");
      // Route structure
      expect(res.body).toHaveProperty("route");
      expect(res.body.route).toHaveProperty("type");
      // Meta
      expect(res.body).toHaveProperty("meta");
      expect(res.body.meta).toHaveProperty("quotedAt");
      expect(res.body.meta).toHaveProperty("chainId");
    });

    it("returns requestId in response", async () => {
      const res = await request(app)
        .get("/v1/quotes/1/fast")
        .set("x-api-key", "TEST_KEY")
        .query({
          sellToken: "ETH",
          buyToken: "DAI",
          sellAmount: "1000000000000000000",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("requestId");
    });

    it("returns 400 when sellToken is missing", async () => {
      const res = await request(app)
        .get("/v1/quotes/1/fast")
        .set("x-api-key", "TEST_KEY")
        .query({ buyToken: "DAI", sellAmount: "1000000000000000000" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when sellAmount is not numeric", async () => {
      const res = await request(app)
        .get("/v1/quotes/1/fast")
        .set("x-api-key", "TEST_KEY")
        .query({
          sellToken: "ETH",
          buyToken: "DAI",
          sellAmount: "not-a-number",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /v1/quotes/:chainId/best", () => {
    it("returns correct shape including strategyUsed", async () => {
      const res = await request(app)
        .get("/v1/quotes/1/best")
        .set("x-api-key", "TEST_KEY")
        .query({
          sellToken: "ETH",
          buyToken: "DAI",
          sellAmount: "1000000000000000000",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("amountIn");
      expect(res.body).toHaveProperty("amountOut");
      expect(res.body).toHaveProperty("amountOutMin");
      expect(res.body).toHaveProperty("route");
      expect(res.body).toHaveProperty("meta");
      expect(res.body).toHaveProperty("strategyUsed");
    });

    it("returns 400 for invalid strategy value", async () => {
      const res = await request(app)
        .get("/v1/quotes/1/best")
        .set("x-api-key", "TEST_KEY")
        .query({
          sellToken: "ETH",
          buyToken: "DAI",
          sellAmount: "1000000000000000000",
          strategy: "invalid_strategy",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/quotes/:chainId/batch", () => {
    it("returns results array with per-quote status", async () => {
      const res = await request(app)
        .post("/v1/quotes/1/batch")
        .set("x-api-key", "TEST_KEY")
        .send({
          quotes: [
            {
              sellToken: "ETH",
              buyToken: "DAI",
              sellAmount: "1000000000000000000",
            },
            { sellToken: "DAI", buyToken: "USDC", sellAmount: "1000000" },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("results");
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0]).toHaveProperty("ok");
    });

    it("returns 400 when quotes array is empty", async () => {
      const res = await request(app)
        .post("/v1/quotes/1/batch")
        .set("x-api-key", "TEST_KEY")
        .send({ quotes: [] });

      expect(res.status).toBe(400);
    });
  });
});
