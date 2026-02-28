import { AppError } from "../core/errors";
import { isNativeToken, resolveTokenInput } from "../domain/token/NativeTokens";
import { staticTokenRepository } from "../domain/token/StaticTokenRepository";
import { SmartRouter, Strategy } from "../lib/smartRouter";
import { getChain } from "./chainService";

export type { TokenInfo } from "../domain/token/types";

/**
 * List tokens for a specific chain with optional search and pagination.
 */
export function listTokens(
  chainId: string,
  search = "",
  limit = 25,
  offset = 0,
) {
  const chain = getChain(chainId);
  if (!chain) return { total: 0, items: [] };
  return staticTokenRepository.list(chainId, search, limit, offset);
}

/**
 * Find a token by symbol or address.
 */
export function findToken(chainId: string, tokenIdentifier: string) {
  return staticTokenRepository.findBySymbolOrAddress(chainId, tokenIdentifier);
}

/**
 * Get quote estimate for a token swap
 *
 * @param chainId - Chain ID as string
 * @param sellToken - Token to sell (symbol or address)
 * @param buyToken - Token to buy (symbol or address)
 * @param sellAmountRaw - Amount to sell in wei
 * @param strategy - Routing strategy (fast, best, split, nosplit, converge)
 */
export async function quoteEstimate(
  chainId: string,
  sellToken: string,
  buyToken: string,
  sellAmountRaw: string,
  strategy: Strategy = "best",
) {
  const sell = findToken(chainId, sellToken);
  const buy = findToken(chainId, buyToken);
  const isSellNative = isNativeToken(sellToken);
  const isBuyNative = isNativeToken(buyToken);

  const tokenIn = resolveTokenInput(sell, sellToken, isSellNative);
  const tokenOut = resolveTokenInput(buy, buyToken, isBuyNative);

  // Validate that tokens are valid addresses or native symbols
  if (!sell && !isSellNative && !sellToken.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw AppError.NotFound(
      "token_not_found",
      `Sell token '${sellToken}' not found. Use token address (0x...) or symbol (e.g., ETH, USDC)`,
    );
  }
  if (!buy && !isBuyNative && !buyToken.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw AppError.NotFound(
      "token_not_found",
      `Buy token '${buyToken}' not found. Use token address (0x...) or symbol (e.g., ETH, USDC)`,
    );
  }

  // Validate amount
  const sellAmount = BigInt(sellAmountRaw);
  if (sellAmount <= 0n) {
    throw AppError.BadRequest(
      "invalid_amount",
      "Amount must be greater than 0",
    );
  }

  // Convert chainId to number
  const chainIdNum = parseInt(chainId, 10);

  // Call SmartRouter to get quote
  return SmartRouter.getBestQuote(
    chainIdNum,
    tokenIn,
    tokenOut,
    sellAmount,
    strategy,
  );
}
