import prisma from "../../lib/prisma";
import * as authService from "../auth/service";

export function resolveListKeysInput(
  user: { id?: number; role?: string } | null,
  query: Record<string, unknown>,
) {
  const page = query.page ? Number(query.page) : 1;
  const perPage = query.perPage ? Number(query.perPage) : 25;
  const queryUserId = query.userId ? Number(query.userId) : undefined;

  const effectiveUserId = user && user.role !== "admin" ? user.id : queryUserId;

  return {
    page,
    perPage,
    effectiveUserId,
  };
}

/**
 * List API keys with pagination.
 */
export async function listKeys(userId?: number | null, page = 1, perPage = 25) {
  const offset = (page - 1) * perPage;
  const where = typeof userId === "number" ? { user_id: userId } : {};

  const [total, rows] = await Promise.all([
    prisma.api_keys.count({ where }),
    prisma.api_keys.findMany({
      where,
      orderBy: { id: "desc" },
      skip: offset,
      take: perPage,
    }),
  ]);

  return { total, rows };
}

/**
 * Create a new API key.
 */
export async function createKey(opts: {
  userId?: number | null;
  tier?: string;
  persist?: boolean;
}) {
  return authService.createApiKey(opts);
}

/**
 * Revoke an API key by prefix, checking ownership.
 */
export async function revokeKeyByUser(
  prefix: string,
  userId: number | null,
  isAdmin = false,
) {
  const keyRecord = await prisma.api_keys.findUnique({
    where: { key_prefix: prefix },
  });

  if (!keyRecord) return { ok: false, notFound: true };
  if (!isAdmin && keyRecord.user_id !== userId)
    return { ok: false, forbidden: true };

  await authService.revokeKey(prefix);
  return { ok: true };
}

/**
 * Update IP/Domain whitelist for an API key.
 */
export async function updateWhitelistByUser(
  prefix: string,
  whitelisted_ips: string[] | null,
  whitelisted_domains: string[] | null,
  userId: number | null,
  isAdmin = false,
) {
  const keyRecord = await prisma.api_keys.findUnique({
    where: { key_prefix: prefix },
  });

  if (!keyRecord) return { notFound: true };
  if (!isAdmin && keyRecord.user_id !== userId) return { forbidden: true };

  const ips = whitelisted_ips || [];
  const domains = whitelisted_domains || [];

  const updated = await prisma.api_keys.update({
    where: { key_prefix: prefix },
    data: {
      whitelisted_ips: ips,
      whitelisted_domains: domains,
    },
  });

  return { ok: true, key: updated };
}

/**
 * Get usage analytics for an API key.
 * Uses raw SQL due to partitioned table being ignored in Prisma.
 */
export async function usageAnalytics(
  prefix: string,
  start?: string | null,
  end?: string | null,
  limit = 30,
) {
  const rec = await authService.getApiKeyByPrefix(prefix.slice(0, 8));
  if (!rec) return null;
  const apiKeyId = rec.id;

  // Use raw query for ignored/partitioned table
  const stats: any[] = await prisma.$queryRawUnsafe(
    `
    SELECT date_trunc('day', created_at) as day, count(*) as requests, sum(cost) as cost
    FROM api_usage_logs
    WHERE api_key_id = $1
      ${start ? "AND created_at >= $2" : ""}
      ${end ? (start ? "AND created_at <= $3" : "AND created_at <= $2") : ""}
    GROUP BY day
    ORDER BY day DESC
    LIMIT ${limit}
  `,
    ...[apiKeyId, start, end].filter(Boolean),
  );

  return { apiKey: { id: apiKeyId, prefix: rec.key_prefix }, stats };
}

/**
 * Get usage analytics for a user, checking ownership of the key.
 */
export async function usageAnalyticsByUser(
  prefix: string,
  userId: number | null,
  isAdmin = false,
  start?: string | null,
  end?: string | null,
  limit = 30,
) {
  const rec = await authService.getApiKeyByPrefix(prefix.slice(0, 8));
  if (!rec) return { notFound: true };
  if (!isAdmin && rec.user_id !== userId) return { forbidden: true };

  const stats = await usageAnalytics(prefix, start, end, limit);
  return { ...stats, forbidden: false, notFound: false };
}
