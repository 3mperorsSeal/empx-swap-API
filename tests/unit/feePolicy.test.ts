/**
 * FeePolicy unit tests — verifies tier → bps mapping and default fallback.
 * These tests document the invariant: fee values must not change silently.
 */

jest.mock("../../src/lib/prisma", () => {
  const mockPrisma = {
    api_keys: { findFirst: jest.fn() },
  };
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  };
});

import prisma from "../../src/lib/prisma";
import {
  getPartnerFee,
  TIER_FEE_BPS,
  DEFAULT_FEE_BPS,
} from "../../src/domain/fee/FeePolicy";

describe("FeePolicy", () => {
  afterEach(() => jest.resetAllMocks());

  describe("TIER_FEE_BPS constants", () => {
    it("free tier = 30 bps (0.30%)", () => {
      expect(TIER_FEE_BPS["free"]).toBe(30);
    });

    it("developer tier = 25 bps (0.25%)", () => {
      expect(TIER_FEE_BPS["developer"]).toBe(25);
    });

    it("pro tier = 20 bps (0.20%)", () => {
      expect(TIER_FEE_BPS["pro"]).toBe(20);
    });

    it("DEFAULT_FEE_BPS = 25", () => {
      expect(DEFAULT_FEE_BPS).toBe(25);
    });
  });

  describe("getPartnerFee()", () => {
    it("returns DEFAULT_FEE_BPS when no apiKeyPrefix provided", async () => {
      const fee = await getPartnerFee();
      expect(fee).toBe(DEFAULT_FEE_BPS);
    });

    it("returns DEFAULT_FEE_BPS when apiKeyPrefix is undefined", async () => {
      const fee = await getPartnerFee(undefined);
      expect(fee).toBe(DEFAULT_FEE_BPS);
    });

    it("returns DEFAULT_FEE_BPS when key not found in DB", async () => {
      (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue(null);
      const fee = await getPartnerFee("ak_notfound");
      expect(fee).toBe(DEFAULT_FEE_BPS);
    });

    it("returns 30 for free tier key", async () => {
      (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
        tier: "free",
      });
      const fee = await getPartnerFee("ak_free1234");
      expect(fee).toBe(30);
    });

    it("returns 25 for developer tier key", async () => {
      (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
        tier: "developer",
      });
      const fee = await getPartnerFee("ak_dev12345");
      expect(fee).toBe(25);
    });

    it("returns 20 for pro tier key", async () => {
      (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
        tier: "pro",
      });
      const fee = await getPartnerFee("ak_pro12345");
      expect(fee).toBe(20);
    });

    it("returns DEFAULT_FEE_BPS for unknown tier", async () => {
      (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
        tier: "enterprise",
      });
      const fee = await getPartnerFee("ak_ent12345");
      expect(fee).toBe(DEFAULT_FEE_BPS);
    });

    it("slices prefix to 8 characters before DB lookup", async () => {
      (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
        tier: "pro",
      });
      await getPartnerFee("ak_longprefixvalue");
      expect(prisma.api_keys.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ key_prefix: "ak_longp" }),
        }),
      );
    });
  });
});
