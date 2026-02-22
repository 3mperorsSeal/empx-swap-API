import request from "supertest";
import prisma from "../../src/lib/prisma";

// Mock prisma before importing app
jest.mock("../../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
    api_keys: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
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
  },
}));

import app from "../../src/index";

describe("Auth controller routes", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("POST /v1/auth/generate validates and returns key", async () => {
    (prisma.api_keys.create as jest.Mock).mockResolvedValue({ id: 1 });
    const res = await request(app)
      .post("/v1/auth/generate")
      .send({ persist: false, tier: "free" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("key");
    expect(res.body).toHaveProperty("prefix");
  });

  test("POST /v1/auth/generate invalid body => 400", async () => {
    const res = await request(app)
      .post("/v1/auth/generate")
      .send({ persist: "nope" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "invalid_request");
  });

  test("POST /v1/auth/revoke without auth => 401", async () => {
    const res = await request(app)
      .post("/v1/auth/revoke")
      .send({ prefix: "NONEXIST" });
    expect(res.status).toBe(401);
  });

  test("POST /v1/auth/revoke with TEST_KEY returns 200", async () => {
    const testKey = "TEST_KEY_12345678";
    process.env.TEST_KEY = testKey;

    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      key_prefix: testKey.substring(0, 8),
      key_hash: "mock_hash",
      revoked: false,
      tier: "pro",
    });
    (prisma.api_keys.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post("/v1/auth/revoke")
      .set("x-api-key", testKey)
      .send({ prefix: "TEST_PREFIX" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("revoked", true);
  });

  test("GET /v1/auth/me with TEST_KEY returns apiKey", async () => {
    const testKey = "TEST_KEY_12345678";
    process.env.TEST_KEY = testKey;

    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      key_prefix: testKey.substring(0, 8),
      key_hash: "mock_hash",
      revoked: false,
      tier: "pro",
    });

    const res = await request(app).get("/v1/auth/me").set("x-api-key", testKey);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("apiKey");
  });
});
