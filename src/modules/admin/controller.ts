import { Request, Response } from "express";
import logger from "../../core/logger";
import * as configService from "../../services/configService";
import * as chainAdapterService from "../../services/chainAdapterService";
import { listChains } from "../../services/chainService";

export async function seed(req: Request, res: Response) {
  try {
    // Default tiers
    const tiers = [
      {
        name: "free",
        description: "Free tier with limited access",
        features: { demo: true },
      },
      {
        name: "pro",
        description: "Paid tier with higher limits",
        features: { demo: false },
      },
    ];

    const createdTiers: any[] = [];
    for (const t of tiers) {
      const tier = await configService.createTier(
        t.name,
        t.description,
        t.features,
      );
      createdTiers.push(tier);
    }

    // Default endpoints to seed
    const endpointsToCreate = [
      {
        path: "/v1/quotes/{chainId}/fast",
        method: "get",
        description: "Fast quote",
      },
      {
        path: "/v1/quotes/{chainId}/best",
        method: "get",
        description: "Best quote with strategy",
      },
      {
        path: "/v1/quotes/{chainId}/batch",
        method: "post",
        description: "Batch quotes",
      },
      {
        path: "/v1/swap/{chainId}/build",
        method: "post",
        description: "Build swap transaction",
      },
      {
        path: "/v1/chains",
        method: "get",
        description: "List supported chains",
      },
      {
        path: "/v1/chains/{chainId}/tokens",
        method: "get",
        description: "List tokens for chain",
      },
    ];

    const createdEndpoints: any[] = [];
    for (const e of endpointsToCreate) {
      const ep = await configService.createEndpoint(
        e.path,
        e.method,
        e.description,
      );
      createdEndpoints.push(ep);
    }

    // Attach tier_endpoint_configs with example values
    for (const tier of createdTiers) {
      for (const ep of createdEndpoints) {
        const rate_limit = tier.name === "free" ? 20 : 1000;
        const quota = tier.name === "free" ? 1000 : 100000;
        const price = tier.name === "free" ? 0 : 0.0001;
        await configService.upsertTierEndpointConfig(tier.id, ep.id, {
          rate_limit,
          quota,
          price_per_request: price,
          metadata: { seeded: true },
        });
      }
    }

    // Seed chain adapters for known chains
    const chains = listChains();
    const createdAdapters: any[] = [];
    for (const c of chains) {
      const primary = await chainAdapterService.upsertAdapter(
        c.chainId,
        "primary_rpc",
        {
          max_rpc_per_min: 1000,
          fee_per_call: 0,
          priority: 10,
          metadata: { rpc: c.rpc || null },
        },
      );
      createdAdapters.push(primary);
      const backup = await chainAdapterService.upsertAdapter(
        c.chainId,
        "backup_rpc",
        { max_rpc_per_min: 200, fee_per_call: 0, priority: 100, metadata: {} },
      );
      createdAdapters.push(backup);
    }

    res.json({
      ok: true,
      tiers: createdTiers.length,
      endpoints: createdEndpoints.length,
      adapters: createdAdapters.length,
    });
  } catch (err) {
    logger.error("admin.seed.error", { err });
    res.status(500).json({ error: "seed_failed" });
  }
}
