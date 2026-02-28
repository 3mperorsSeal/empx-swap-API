/**
 * Auth guard contract tests — assert apiKeyGuard behaviour.
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
    chains: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import app from "../../src/index";

const VALID_KEY = {
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

describe("apiKeyGuard contract", () => {
  afterEach(() => jest.resetAllMocks());

  it("returns 401 with missing_api_key when no key provided", async () => {
    const res = await request(app).get("/v1/chains");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "missing_api_key");
  });

  it("returns 401 with invalid_api_key when key not found in DB", async () => {
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/chains")
      .set("x-api-key", "ak_unknown_key_prefix");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "invalid_api_key");
  });

  it("returns 401 with invalid_api_key when key is revoked", async () => {
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue(null); // revoked: true means findFirst with revoked:false returns null

    const res = await request(app)
      .get("/v1/chains")
      .set("x-api-key", "ak_revoked_key_xx");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "invalid_api_key");
  });

  it("returns 403 with ip_not_allowed when client IP is not whitelisted", async () => {
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      ...VALID_KEY,
      whitelisted_ips: ["10.0.0.1"], // only allow 10.0.0.1, test client is 127.0.0.1
    });

    const res = await request(app)
      .get("/v1/chains")
      .set("x-api-key", "TEST_KEY");

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "ip_not_allowed");
  });

  it("returns 200 with valid key, no IP restriction", async () => {
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue(VALID_KEY);
    mockQuotaPassthrough();

    const res = await request(app)
      .get("/v1/chains")
      .set("x-api-key", "TEST_KEY");

    expect(res.status).toBe(200);
  });

  it("attaches apiKey context to request (requestId present)", async () => {
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue(VALID_KEY);
    mockQuotaPassthrough();

    const res = await request(app)
      .get("/v1/chains")
      .set("x-api-key", "TEST_KEY");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("requestId");
  });
});
