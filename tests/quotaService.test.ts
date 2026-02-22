import quotaService from "../src/services/quotaService";
import prisma from "../src/lib/prisma";
import * as configService from "../src/services/configService";

jest.mock("../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    api_usage_quotas_monthly: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    api_usage_quotas_daily: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tier_endpoint_configs: {
      aggregate: jest.fn(),
    },
  },
}));

jest.mock("../src/services/configService");

describe("quotaService.consumeCredit", () => {
  afterEach(() => jest.resetAllMocks());

  test("consumes from monthly purchased credits when available", async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
      cb(prisma),
    );
    (prisma.api_usage_quotas_monthly.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      purchased_credits: 10,
      used_credits: 2,
    });
    (prisma.api_usage_quotas_monthly.update as jest.Mock).mockResolvedValue({});

    const res = await quotaService.consumeCredit({
      apiKeyId: 1,
      path: "/v1/quotes/1/fast",
      method: "GET",
    });

    expect(res.allowed).toBe(true);
    expect(res.usedFrom).toBe("paid");
    expect(res.remainingPaid).toBe(7);
    expect(prisma.api_usage_quotas_monthly.update).toHaveBeenCalled();
  });

  test("falls back to free daily quota when no monthly credits", async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
      cb(prisma),
    );
    (prisma.api_usage_quotas_monthly.findFirst as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.api_usage_quotas_daily.findFirst as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.api_usage_quotas_daily.create as jest.Mock).mockResolvedValue({});

    // Mock endpoint and free tier config
    (configService.getEndpointByPathMethod as any).mockResolvedValue({ id: 1 });
    (configService.getTierByName as any).mockResolvedValue({ id: 1 });
    (configService.getTierEndpointConfig as any).mockResolvedValue({
      quota: 100,
    });

    const res = await quotaService.consumeCredit({
      apiKeyId: 2,
      path: "/v1/quotes/1/fast",
      method: "GET",
    });

    expect(res.allowed).toBe(true);
    expect(res.usedFrom).toBe("free");
    expect(res.remainingFree).toBe(99);
    expect(prisma.api_usage_quotas_daily.create).toHaveBeenCalled();
  });

  test("denies when both paid and free exhausted", async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
      cb(prisma),
    );
    (prisma.api_usage_quotas_monthly.findFirst as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.api_usage_quotas_daily.findFirst as jest.Mock).mockResolvedValue({
      used_credits: 100,
    });

    (configService.getEndpointByPathMethod as any).mockResolvedValue({ id: 1 });
    (configService.getTierByName as any).mockResolvedValue({ id: 1 });
    (configService.getTierEndpointConfig as any).mockResolvedValue({
      quota: 100,
    });

    const res = await quotaService.consumeCredit({
      apiKeyId: 3,
      path: "/v1/quotes/1/fast",
      method: "GET",
    });

    expect(res.allowed).toBe(false);
  });
});
