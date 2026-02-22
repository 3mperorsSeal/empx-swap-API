/**
 * Contract Configuration
 *
 * This file contains contract addresses and RPC endpoints for all supported chains.
 *
 * TODO: Replace placeholder addresses with actual deployed contract addresses
 * TODO: Configure RPC endpoints in .env file
 */

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  routerAddress: `0x${string}`;
  wrappedNative: `0x${string}`;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  multicall3?: `0x${string}`;
  explorer?: string;
}

/**
 * Chain configurations
 *
 * When you deploy contracts or get contract addresses, update these values:
 * - routerAddress: Your EmpsealRouter contract address
 * - wrappedNative: Wrapped native token (WPLS, WETH, WMATIC)
 * - rpcUrl: Your RPC provider endpoint (from .env)
 */
export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // PulseChain Mainnet
  369: {
    chainId: 369,
    name: "PulseChain",
    rpcUrl: process.env.PULSECHAIN_RPC_URL || "https://rpc.pulsechain.com",
    // TODO: Replace with actual deployed router address
    routerAddress: "0x0000000000000000000000000000000000000000",
    // TODO: Replace with actual WPLS address
    wrappedNative: "0x0000000000000000000000000000000000000000",
    nativeCurrency: {
      name: "Pulse",
      symbol: "PLS",
      decimals: 18,
    },
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    explorer: "https://scan.pulsechain.com",
  },

  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: "Ethereum",
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://cloudflare-eth.com",
    // TODO: Replace with actual deployed router address
    routerAddress: "0x0000000000000000000000000000000000000000",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    explorer: "https://etherscan.io",
  },

  // Polygon Mainnet
  137: {
    chainId: 137,
    name: "Polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || "https://rpc.ankr.com/polygon",
    // TODO: Replace with actual deployed router address
    routerAddress: "0x0000000000000000000000000000000000000000",
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
    nativeCurrency: {
      name: "Matic",
      symbol: "MATIC",
      decimals: 18,
    },
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    explorer: "https://polygonscan.com",
  },
};

/**
 * Get chain configuration by chainId
 */
export function getChainConfig(chainId: number): ChainConfig | null {
  return CHAIN_CONFIGS[chainId] || null;
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_CONFIGS;
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(CHAIN_CONFIGS).map(Number);
}

/**
 * Check if contracts are configured for a chain
 * Returns false if using placeholder addresses
 */
export function hasRealContracts(chainId: number): boolean {
  const config = getChainConfig(chainId);
  if (!config) return false;

  // Check if router address is not the zero address (placeholder)
  return config.routerAddress !== "0x0000000000000000000000000000000000000000";
}
