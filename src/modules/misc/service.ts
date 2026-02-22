import Redis from "ioredis";

import config from "../.././core/config";
import { prisma } from "../../lib/prisma";

export async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

export async function checkRedis() {
  if (!config.REDIS_URL) {
    return "skipped (no url)";
  }

  const redis = new Redis(config.REDIS_URL, { lazyConnect: true });
  try {
    await redis.connect();
    await redis.ping();
    return "ok";
  } finally {
    await redis.quit();
  }
}
