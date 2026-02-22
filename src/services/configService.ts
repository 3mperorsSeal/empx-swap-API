import logger from "../core/logger";
import prisma from "../lib/prisma";

export type Tier = {
  id: number;
  name: string;
  description?: string | null;
  features?: any;
  created_at?: Date | null;
};

export type Endpoint = {
  id: number;
  path: string;
  method: string;
  description?: string | null;
  created_at?: Date | null;
};

export type TierEndpointConfig = {
  id: number;
  tier_id: number;
  endpoint_id: number;
  rate_limit: number | null;
  quota: number | null;
  price_per_request: any; // Prisma Decimal
  metadata?: any;
  created_at?: Date | null;
};

export async function listTiers(): Promise<Tier[]> {
  try {
    return await prisma.tiers.findMany({
      orderBy: { id: "asc" },
    });
  } catch (err) {
    logger.error("configService.listTiers.error", { err });
    throw err;
  }
}

export async function getTierByName(name: string): Promise<Tier | null> {
  try {
    return await prisma.tiers.findUnique({
      where: { name },
    });
  } catch (err) {
    logger.error("configService.getTierByName.error", { err, name });
    throw err;
  }
}

export async function listEndpoints(): Promise<Endpoint[]> {
  try {
    return await prisma.endpoints.findMany({
      orderBy: { id: "asc" },
    });
  } catch (err) {
    logger.error("configService.listEndpoints.error", { err });
    throw err;
  }
}

export async function getEndpointByPathMethod(
  path: string,
  method: string,
): Promise<Endpoint | null> {
  try {
    return await prisma.endpoints.findUnique({
      where: { path_method: { path, method } },
    });
  } catch (err) {
    logger.error("configService.getEndpointByPathMethod.error", {
      err,
      path,
      method,
    });
    throw err;
  }
}

export async function createTier(
  name: string,
  description: string | null = null,
  features: any = {},
): Promise<Tier> {
  try {
    return await prisma.tiers.upsert({
      where: { name },
      update: {
        description: description || undefined,
      },
      create: {
        name,
        description,
        features,
      },
    });
  } catch (err) {
    logger.error("configService.createTier.error", { err, name });
    throw err;
  }
}

export async function createEndpoint(
  path: string,
  method: string,
  description: string | null = null,
): Promise<Endpoint> {
  try {
    return await prisma.endpoints.upsert({
      where: { path_method: { path, method } },
      update: {
        description: description || undefined,
      },
      create: {
        path,
        method,
        description,
      },
    });
  } catch (err) {
    logger.error("configService.createEndpoint.error", {
      err,
      path,
      method,
    });
    throw err;
  }
}

export async function getTierEndpointConfig(
  tierId: number,
  endpointId: number,
): Promise<TierEndpointConfig | null> {
  try {
    return await prisma.tier_endpoint_configs.findUnique({
      where: {
        tier_id_endpoint_id: { tier_id: tierId, endpoint_id: endpointId },
      },
    });
  } catch (err) {
    logger.error("configService.getTierEndpointConfig.error", {
      err,
      tierId,
      endpointId,
    });
    throw err;
  }
}

export async function upsertTierEndpointConfig(
  tierId: number,
  endpointId: number,
  opts: {
    rate_limit?: number;
    quota?: number;
    price_per_request?: number | string;
    metadata?: any;
  },
): Promise<TierEndpointConfig> {
  try {
    return await prisma.tier_endpoint_configs.upsert({
      where: {
        tier_id_endpoint_id: { tier_id: tierId, endpoint_id: endpointId },
      },
      update: {
        rate_limit: opts.rate_limit,
        quota: opts.quota,
        price_per_request: opts.price_per_request,
        metadata: opts.metadata,
      },
      create: {
        tier_id: tierId,
        endpoint_id: endpointId,
        rate_limit: opts.rate_limit || 0,
        quota: opts.quota || 0,
        price_per_request: opts.price_per_request || 0,
        metadata: opts.metadata || {},
      },
    });
  } catch (err) {
    logger.error("configService.upsertTierEndpointConfig.error", {
      err,
      tierId,
      endpointId,
      opts,
    });
    throw err;
  }
}
