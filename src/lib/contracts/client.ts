/**
 * Viem Client Factory
 *
 * Creates and caches viem publicClient instances for blockchain interactions.
 * Supports fallback to mock mode when contracts aren't configured.
 */

import {
  createPublicClient,
  getContract,
  GetContractReturnType,
  http,
  PublicClient,
} from "viem";
import { mainnet, polygon } from "viem/chains";
import { ADAPTER_ABI, EMPSEAL_ROUTER_ABI, ERC20_ABI } from "./abis";
import { getChainConfig, hasRealContracts } from "./config";
import logger from "../../core/logger";

// Define PulseChain since it's not in viem's default chains
const pulsechain = {
  id: 369,
  name: "PulseChain",
  network: "pulsechain",
  nativeCurrency: {
    decimals: 18,
    name: "Pulse",
    symbol: "PLS",
  },
  rpcUrls: {
    default: { http: ["https://rpc.pulsechain.com"] },
    public: { http: ["https://rpc.pulsechain.com"] },
  },
  blockExplorers: {
    default: { name: "PulseScan", url: "https://scan.pulsechain.com" },
  },
} as const;

// Map of chain ID to viem chain objects
const VIEM_CHAINS = {
  1: mainnet,
  137: polygon,
  369: pulsechain,
} as const;

// Cache for publicClient instances
const clientCache = new Map<number, PublicClient>();

/**
 * Get or create a viem publicClient for a chain
 */
export function getPublicClient(chainId: number): PublicClient | null {
  // Check cache first
  if (clientCache.has(chainId)) {
    return clientCache.get(chainId)!;
  }

  // Get chain config
  const config = getChainConfig(chainId);
  if (!config) {
    logger.warn("getPublicClient: Unsupported chain", { chainId });
    return null;
  }

  // Get viem chain object
  const viemChain = VIEM_CHAINS[chainId as keyof typeof VIEM_CHAINS];
  if (!viemChain) {
    logger.warn("getPublicClient: No viem chain config", { chainId });
    return null;
  }

  try {
    // Create client
    const client = createPublicClient({
      chain: viemChain,
      transport: http(config.rpcUrl, {
        retryCount: 3,
        retryDelay: 1000,
      }),
    });

    // Cache it
    clientCache.set(chainId, client);

    logger.info("Created viem client", { chainId, rpcUrl: config.rpcUrl });
    return client;
  } catch (error) {
    logger.error("Failed to create viem client", { chainId, error });
    return null;
  }
}

/**
 * Get router contract instance
 */
export function getRouterContract(
  chainId: number,
): GetContractReturnType<typeof EMPSEAL_ROUTER_ABI, PublicClient> | null {
  const client = getPublicClient(chainId);
  const config = getChainConfig(chainId);

  if (!client || !config) {
    return null;
  }

  return getContract({
    address: config.routerAddress,
    abi: EMPSEAL_ROUTER_ABI,
    client,
  });
}

/**
 * Get ERC20 token contract instance
 */
export function getERC20Contract(
  chainId: number,
  tokenAddress: `0x${string}`,
): GetContractReturnType<typeof ERC20_ABI, PublicClient> | null {
  const client = getPublicClient(chainId);

  if (!client) {
    return null;
  }

  return getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client,
  });
}

/**
 * Get adapter contract instance
 */
export function getAdapterContract(
  chainId: number,
  adapterAddress: `0x${string}`,
): GetContractReturnType<typeof ADAPTER_ABI, PublicClient> | null {
  const client = getPublicClient(chainId);

  if (!client) {
    return null;
  }

  return getContract({
    address: adapterAddress,
    abi: ADAPTER_ABI,
    client,
  });
}

/**
 * Check if we can make real blockchain calls for a chain
 */
export function canMakeRealCalls(chainId: number): boolean {
  return hasRealContracts(chainId) && getPublicClient(chainId) !== null;
}

/**
 * Clear client cache (useful for testing or when RPC URLs change)
 */
export function clearClientCache(): void {
  clientCache.clear();
  logger.info("Cleared viem client cache");
}
