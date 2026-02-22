import logger from "../core/logger";
import prisma from "../lib/prisma";
import {
  getEndpointByPathMethod,
  getTierByName,
  getTierEndpointConfig,
} from "./configService";

type ConsumeResult = {
  allowed: boolean;
  usedFrom?: "paid" | "free";
  remainingPaid?: number;
  remainingFree?: number;
};

/**
 * Consumes a credit for an API request.
 * Tries paid monthly credits first, then falls back to tier's daily quota.
 */
export async function consumeCredit(opts: {
  apiKeyId?: number | null;
  userId?: number | null;
  path: string;
  method: string;
  cost?: number;
  tier?: string;
}): Promise<ConsumeResult> {
  const apiKeyId = opts.apiKeyId ?? null;
  const userId = opts.userId ?? null;
  const cost = opts.cost || 1;
  const tierName = opts.tier || "free";

  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;

      // 1. Attempt to consume from paid monthly credits first
      const monthlyId = apiKeyId || userId;
      if (monthlyId) {
        const monthlyQuota = await tx.api_usage_quotas_monthly.findFirst({
          where: apiKeyId
            ? { api_key_id: apiKeyId, year, month }
            : { user_id: userId, year, month },
        });

        if (monthlyQuota) {
          const remaining =
            monthlyQuota.purchased_credits - monthlyQuota.used_credits;
          if (remaining >= cost) {
            await tx.api_usage_quotas_monthly.update({
              where: { id: monthlyQuota.id },
              data: { used_credits: { increment: cost } },
            });
            return {
              allowed: true,
              usedFrom: "paid",
              remainingPaid: remaining - cost,
            };
          }
        }
      }

      // 2. Paid credits not available — attempt to consume tier's daily quota
      const ep = await getEndpointByPathMethod(opts.path, opts.method);
      let dailyQuotaLimit = 0;
      if (ep) {
        const tier = await getTierByName(tierName);
        if (tier) {
          const cfg = await getTierEndpointConfig(tier.id, ep.id);
          dailyQuotaLimit = cfg ? cfg.quota || 0 : 0;
        }
      }

      if (dailyQuotaLimit <= 0) {
        logger.warn("quotaService.no_quota", {
          path: opts.path,
          method: opts.method,
          tier: tierName,
          endpoint: ep?.id,
        });
        return { allowed: false };
      }

      const date = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const dailyId = apiKeyId || userId;

      if (!dailyId) {
        return { allowed: false };
      }

      const dailyQuota = await tx.api_usage_quotas_daily.findFirst({
        where: apiKeyId
          ? { api_key_id: apiKeyId, date }
          : { user_id: userId, date },
      });

      if (dailyQuota) {
        if (dailyQuota.used_credits + cost <= dailyQuotaLimit) {
          await tx.api_usage_quotas_daily.update({
            where: { id: dailyQuota.id },
            data: { used_credits: { increment: cost } },
          });
          return {
            allowed: true,
            usedFrom: "free",
            remainingFree: dailyQuotaLimit - (dailyQuota.used_credits + cost),
          };
        }
        return { allowed: false };
      }

      // Row doesn't exist yet
      if (cost <= dailyQuotaLimit) {
        await tx.api_usage_quotas_daily.create({
          data: {
            api_key_id: apiKeyId,
            user_id: userId,
            date,
            used_credits: cost,
          },
        });
        return {
          allowed: true,
          usedFrom: "free",
          remainingFree: dailyQuotaLimit - cost,
        };
      }

      return { allowed: false };
    });
  } catch (err) {
    logger.error("quotaService.consumeCredit.error", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { allowed: false };
  }
}

/**
 * Adds monthly credits for an API key or user.
 */
export async function addMonthlyCredits(opts: {
  apiKeyId?: number | null;
  userId?: number | null;
  credits: number;
}) {
  const apiKeyId = opts.apiKeyId ?? null;
  const userId = opts.userId ?? null;
  const credits = opts.credits || 0;
  if (!apiKeyId && !userId) throw new Error("apiKeyId or userId required");

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  // Use upsert
  await prisma.api_usage_quotas_monthly.upsert({
    where: {
      api_key_id_year_month: apiKeyId
        ? { api_key_id: apiKeyId, year, month }
        : undefined,
      // Note: Prisma upsert unique constraint handling for multi-option identifiers is tricky.
      // Since model has @@unique([api_key_id, year, month]), we use that.
      // If it's user_id, we might need a different unique constraint or handled manually.
    },
    update: {
      purchased_credits: { increment: credits },
      updated_at: new Date(),
    },
    create: {
      api_key_id: apiKeyId,
      user_id: userId,
      year,
      month,
      purchased_credits: credits,
      used_credits: 0,
    },
  });
}

/**
 * Gets currently remaining usage stats.
 */
export async function getUsage(opts: {
  apiKeyId?: number | null;
  userId?: number | null;
}) {
  const apiKeyId = opts.apiKeyId ?? null;
  const userId = opts.userId ?? null;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  // Monthly remaining
  const monthlyQuota = await prisma.api_usage_quotas_monthly.findFirst({
    where: apiKeyId
      ? { api_key_id: apiKeyId, year, month }
      : { user_id: userId, year, month },
  });
  const remainingPaid = monthlyQuota
    ? Math.max(0, monthlyQuota.purchased_credits - monthlyQuota.used_credits)
    : 0;

  // Free daily remaining
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dailyQuota = await prisma.api_usage_quotas_daily.findFirst({
    where: apiKeyId
      ? { api_key_id: apiKeyId, date }
      : { user_id: userId, date },
  });
  const usedDaily = dailyQuota ? dailyQuota.used_credits : 0;

  // Compute free quota sum for free tier
  const t = await getTierByName("free");
  let freeQuotaSum = 0;
  if (t) {
    const aggregate = await prisma.tier_endpoint_configs.aggregate({
      where: { tier_id: t.id },
      _sum: { quota: true },
    });
    freeQuotaSum = aggregate._sum.quota || 0;
  }

  const remainingFree = Math.max(0, freeQuotaSum - usedDaily);

  return { remainingPaid, remainingFree };
}

export default { consumeCredit, addMonthlyCredits, getUsage };
