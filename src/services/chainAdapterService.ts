import { getAdapters } from "../lib/contracts/adapters";

export type ChainAdapter = {
  name: string;
  address: string;
};

/**
 * List adapters for a specific chain from the static on-chain registry.
 * chainIdentifier is the numeric chain ID as a string (e.g. "8453").
 */
export async function listAdaptersForChain(
  chainIdentifier: string,
): Promise<ChainAdapter[]> {
  const chainId = parseInt(chainIdentifier, 10);
  if (isNaN(chainId)) return [];
  return getAdapters(chainId);
}
