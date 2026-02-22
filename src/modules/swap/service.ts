import { buildSwapTransaction } from "../../services/swapService";
import * as chainsService from "../chains/service";

/**
 * Checks if a chain is supported.
 */
export async function ensureChain(chainId: string) {
  return chainsService.getChain(chainId);
}

/**
 * Builds a swap transaction using the smart router.
 */
export async function build(
  chainId: string,
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  recipient?: string,
  options?: {
    fee?: number;
    deadline?: number;
    slippage?: number;
    route?: any;
    apiKey?: string;
  },
) {
  return buildSwapTransaction(
    chainId,
    sellToken,
    buyToken,
    sellAmount,
    recipient,
    options,
  );
}
