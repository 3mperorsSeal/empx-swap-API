import request from "supertest";
import prisma from "../src/lib/prisma";

jest.mock("../src/lib/prisma", () => {
  const mockPrisma = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
    api_keys: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    partner_usage_logs: {
      create: jest.fn().mockResolvedValue({}),
    },
    tier_endpoint_configs: {
      findUnique: jest.fn(),
      aggregate: jest.fn(),
    },
    api_usage_quotas_monthly: {
      findFirst: jest.fn(),
    },
    api_usage_quotas_daily: {
      findFirst: jest.fn(),
    },
    tiers: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    endpoints: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    chains: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    chain_tokens: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    tokens: {
      findFirst: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  };
});

import app from "../src/index";

describe("Public API routes", () => {
  beforeEach(() => {
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      key_prefix: "TEST_KEY",
      tier: "pro",
      user_id: 1,
      revoked: false,
      whitelisted_ips: [],
      whitelisted_domains: [],
    });
  });

  afterEach(() => jest.resetAllMocks());

  test("GET /v1/chains returns chain list", async () => {
    (prisma.chains.findMany as jest.Mock).mockResolvedValue([
      { id: 1, chain_id: "1", name: "Ethereum" },
    ]);
    const res = await request(app)
      .get("/v1/chains")
      .set("x-api-key", "TEST_KEY")
      .set("x-request-id", "test-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("chains");
    expect(Array.isArray(res.body.chains)).toBe(true);
  });

  test("GET /v1/chains/1/tokens returns tokens", async () => {
    (prisma.chains.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      chain_id: "1",
    });
    (prisma.chain_tokens.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        token_id: 1,
        chains: { chain_id: "1" },
        tokens: { symbol: "ETH" },
      },
    ]);
    (prisma.chain_tokens.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get("/v1/chains/1/tokens")
      .set("x-api-key", "TEST_KEY");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("items");
  });

  test("GET /v1/quotes/1/fast missing params => 400", async () => {
    const res = await request(app)
      .get("/v1/quotes/1/fast")
      .set("x-api-key", "TEST_KEY");
    expect(res.status).toBe(400);
  });

  test("GET /v1/quotes/1/fast valid => 200", async () => {
    (prisma.chains.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      chain_id: "1",
    });
    (prisma.chain_tokens.findFirst as jest.Mock).mockResolvedValue({ id: 1 });
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
      name: "free",
    });
    (prisma.tier_endpoint_configs.findUnique as jest.Mock).mockResolvedValue({
      quota: 100,
    });

    const res = await request(app)
      .get("/v1/quotes/1/fast")
      .set("x-api-key", "TEST_KEY")
      .query({
        sellToken: "ETH",
        buyToken: "DAI",
        sellAmount: "1000000000000000000",
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("amountOut");
    expect(res.body).toHaveProperty("route");
  });

  test("GET /v1/quotes/1/best valid => 200", async () => {
    (prisma.chains.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      chain_id: "1",
    });
    (prisma.chain_tokens.findFirst as jest.Mock).mockResolvedValue({ id: 1 });
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
      name: "free",
    });
    (prisma.tier_endpoint_configs.findUnique as jest.Mock).mockResolvedValue({
      quota: 100,
    });

    const res = await request(app)
      .get("/v1/quotes/1/best")
      .set("x-api-key", "TEST_KEY")
      .query({ sellToken: "ETH", buyToken: "DAI", sellAmount: "2000" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("amountOut");
    expect(res.body).toHaveProperty("route");
  });

  test("POST /v1/quotes/1/batch returns results", async () => {
    (prisma.chains.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      chain_id: "1",
    });
    (prisma.chain_tokens.findFirst as jest.Mock).mockResolvedValue({ id: 1 });
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
      name: "free",
    });
    (prisma.tier_endpoint_configs.findUnique as jest.Mock).mockResolvedValue({
      quota: 100,
    });

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
          { sellToken: "DAI", buyToken: "USDC", sellAmount: "100" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("results");
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results[0]).toHaveProperty("ok", true);
  });

  test("POST /v1/swap/1/build valid => 200", async () => {
    (prisma.chains.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      chain_id: "1",
    });
    (prisma.chain_tokens.findFirst as jest.Mock).mockResolvedValue({ id: 1 });
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
      name: "free",
    });
    (prisma.tier_endpoint_configs.findUnique as jest.Mock).mockResolvedValue({
      quota: 100,
    });

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
    expect(res.body).toHaveProperty("transaction");
    expect(res.body).toHaveProperty("approval");
  });
});
