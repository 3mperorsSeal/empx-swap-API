import * as chainsService from "../chains/service";

/**
 * Checks if a chain is supported.
 */
export async function ensureChain(chainId: string) {
  return chainsService.getChain(chainId);
}
