import request from "supertest";
import app from "../../src/index";
import prisma from "../../src/lib/prisma";

jest.mock("../../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
    api_keys: {
      findFirst: jest.fn(),
    },
    partner_usage_logs: {
      create: jest.fn().mockResolvedValue({}),
    },
    tier_endpoint_configs: {
      findUnique: jest.fn(),
    },
    api_usage_quotas_monthly: {
      findFirst: jest.fn(),
    },
    api_usage_quotas_daily: {
      findFirst: jest.fn(),
    },
    tiers: {
      findUnique: jest.fn(),
    },
    endpoints: {
      findUnique: jest.fn(),
    },
    chains: {
      findUnique: jest.fn(),
    },
    chain_tokens: {
      findFirst: jest.fn(),
    },
  },
}));

describe("Quote controller validation", () => {
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

  test("GET /v1/quotes/1/fast missing params => 400 (validated)", async () => {
    const res = await request(app)
      .get("/v1/quotes/1/fast")
      .set("x-api-key", "TEST_KEY");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "invalid_query");
  });

  test("GET /v1/quotes/1/fast valid => 200", async () => {
    // Mock chain check
    (prisma.chains.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      chain_id: "1",
    });
    // Mock token checks (sellToken, buyToken)
    (prisma.chain_tokens.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      token_address: "0x...",
    });
    // Mock quota check transaction
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
      cb(prisma),
    );
    (prisma.api_usage_quotas_monthly.findFirst as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.api_usage_quotas_daily.findFirst as jest.Mock).mockResolvedValue({
      used_credits: 0,
    });

    // Mock endpoint and tier for quota fallback
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

  test("POST /v1/quotes/1/batch invalid body => 400", async () => {
    const res = await request(app)
      .post("/v1/quotes/1/batch")
      .set("x-api-key", "TEST_KEY")
      .send({ quotes: [{ sellToken: "ETH" }] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "invalid_request");
  });
});
