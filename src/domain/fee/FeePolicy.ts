/**
 * FeePolicy — single source of truth for tier-based partner fees.
 * All fee logic must live here; consumers import getPartnerFee() from this module.
 */
import { prisma } from "../../lib/prisma";

/** Basis-point fee per API tier (1 bps = 0.01%). */
export const TIER_FEE_BPS: Readonly<Record<string, number>> = {
  free: 30, // 0.30%
  developer: 25, // 0.25%
  pro: 20, // 0.20%
};

/** Default platform fee applied when no key is found (25 bps = 0.25%). */
export const DEFAULT_FEE_BPS = 25;

/**
 * Resolve the fee in basis points for the given raw API key (or prefix).
 * Falls back to DEFAULT_FEE_BPS when the key is absent, revoked, or unknown tier.
 */
export async function getPartnerFee(apiKey?: string): Promise<number> {
  if (!apiKey) return DEFAULT_FEE_BPS;

  const prefix = apiKey.length > 8 ? apiKey.slice(0, 8) : apiKey;
  const record = await prisma.api_keys.findFirst({
    where: { key_prefix: prefix, revoked: false },
    select: { tier: true },
  });

  return TIER_FEE_BPS[record?.tier ?? ""] ?? DEFAULT_FEE_BPS;
}
