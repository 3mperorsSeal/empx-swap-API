import request from "supertest";
import prisma from "../../src/lib/prisma";

jest.mock("../../src/lib/prisma", () => {
  const mockPrisma = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
    api_keys: { findFirst: jest.fn() },
    partner_usage_logs: { create: jest.fn().mockResolvedValue({}) },
    tier_endpoint_configs: { findUnique: jest.fn() },
    api_usage_quotas_monthly: { findFirst: jest.fn() },
    api_usage_quotas_daily: { findFirst: jest.fn() },
    tiers: { findUnique: jest.fn() },
    endpoints: { findUnique: jest.fn() },
    chains: { findUnique: jest.fn() },
    chain_tokens: { findFirst: jest.fn() },
  };
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  };
});

import app from "../../src/index";

describe("DEX API Verification", () => {
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

  const CHAIN_ID = "1";
  const TOKEN_IN = "ETH";
  const TOKEN_OUT = "DAI";
  const AMOUNT_IN = "1000000000000000000"; // 1 ETH

  test("1. Fast Quote returns valid route", async () => {
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
      .get(`/v1/quotes/${CHAIN_ID}/fast`)
      .set("x-api-key", "TEST_KEY")
      .query({
        sellToken: TOKEN_IN,
        buyToken: TOKEN_OUT,
        sellAmount: AMOUNT_IN,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("amountOut");
    expect(res.body.route.type).toBe("NOSPLIT");
  });

  test("2. Best Quote returns converge/split route", async () => {
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
      .get(`/v1/quotes/${CHAIN_ID}/best`)
      .set("x-api-key", "TEST_KEY")
      .query({
        sellToken: TOKEN_IN,
        buyToken: TOKEN_OUT,
        sellAmount: AMOUNT_IN,
      });

    expect(res.status).toBe(200);
    expect(res.body.route.type).toBe("CONVERGE");
  });

  test("3. Swap Build returns transaction data", async () => {
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
      .post(`/v1/swap/${CHAIN_ID}/build`)
      .set("x-api-key", "TEST_KEY")
      .send({
        sellToken: TOKEN_IN,
        buyToken: TOKEN_OUT,
        sellAmount: AMOUNT_IN,
        recipient: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      });

    expect(res.status).toBe(200);
    expect(res.body.transaction).toBeDefined();
  });

  test("4. Batch Quote handles mixed results", async () => {
    (prisma.chains.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      chain_id: "1",
    });
    (prisma.chain_tokens.findFirst as jest.Mock).mockImplementation(
      async ({ where }: any) => {
        if (where.token_address === "INVALID") return null;
        return { id: 1 };
      },
    );
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
      .post(`/v1/quotes/${CHAIN_ID}/batch`)
      .set("x-api-key", "TEST_KEY")
      .send({
        quotes: [
          { sellToken: TOKEN_IN, buyToken: TOKEN_OUT, sellAmount: AMOUNT_IN },
          { sellToken: "INVALID", buyToken: TOKEN_OUT, sellAmount: AMOUNT_IN },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0].ok).toBe(true);
    expect(res.body.results[1].ok).toBe(false);
  });
});
