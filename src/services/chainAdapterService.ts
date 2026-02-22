import logger from "../core/logger";
import prisma from "../lib/prisma";

export type ChainAdapter = {
  id: number;
  chain_id: number;
  adapter_name: string;
  max_rpc_per_min: number | null;
  fee_per_call: any; // Prisma Decimal
  priority: number | null;
  metadata?: any;
  created_at?: Date | null;
};

/**
 * List adapters for a specific chain (resolved via chain_id string).
 */
export async function listAdaptersForChain(
  chainIdentifier: string,
): Promise<ChainAdapter[]> {
  try {
    const chain = await prisma.chains.findUnique({
      where: { chain_id: chainIdentifier },
      select: { id: true },
    });

    if (!chain) return [];

    return await prisma.chain_adapters.findMany({
      where: { chain_id: chain.id },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
    });
  } catch (err) {
    logger.error("chainAdapterService.listAdaptersForChain.error", {
      err: err instanceof Error ? err.message : String(err),
      chainIdentifier,
    });
    throw err;
  }
}

/**
 * Get a specific adapter.
 */
export async function getAdapter(
  chainIdentifier: string,
  adapterName: string,
): Promise<ChainAdapter | null> {
  try {
    const chain = await prisma.chains.findUnique({
      where: { chain_id: chainIdentifier },
      select: { id: true },
    });

    if (!chain) return null;

    return await prisma.chain_adapters.findUnique({
      where: {
        chain_id_adapter_name: {
          chain_id: chain.id,
          adapter_name: adapterName,
        },
      },
    });
  } catch (err) {
    logger.error("chainAdapterService.getAdapter.error", {
      err: err instanceof Error ? err.message : String(err),
      chainIdentifier,
      adapterName,
    });
    throw err;
  }
}

/**
 * Upsert an adapter configuration.
 */
export async function upsertAdapter(
  chainIdentifier: string,
  adapterName: string,
  opts: {
    max_rpc_per_min?: number;
    fee_per_call?: number | string;
    priority?: number;
    metadata?: any;
  },
): Promise<ChainAdapter> {
  try {
    const chain = await prisma.chains.findUnique({
      where: { chain_id: chainIdentifier },
      select: { id: true },
    });

    if (!chain) {
      throw new Error(`Chain ${chainIdentifier} not found`);
    }

    return await prisma.chain_adapters.upsert({
      where: {
        chain_id_adapter_name: {
          chain_id: chain.id,
          adapter_name: adapterName,
        },
      },
      update: {
        max_rpc_per_min: opts.max_rpc_per_min,
        fee_per_call: opts.fee_per_call,
        priority: opts.priority,
        metadata: opts.metadata,
      },
      create: {
        chain_id: chain.id,
        adapter_name: adapterName,
        max_rpc_per_min: opts.max_rpc_per_min || 0,
        fee_per_call: opts.fee_per_call || 0,
        priority: opts.priority || 100,
        metadata: opts.metadata || {},
      },
    });
  } catch (err) {
    logger.error("chainAdapterService.upsertAdapter.error", {
      err: err instanceof Error ? err.message : String(err),
      chainIdentifier,
      adapterName,
      opts,
    });
    throw err;
  }
}
