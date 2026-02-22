import { AppError } from "../core/errors";
import { SmartRouter, Strategy } from "../lib/smartRouter";
import { getChain } from "./chainService";

export type TokenInfo = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number; // mock price
};

// Mock token lists per chainId. In production this should be replaced with a DB or provider.
const TOKENS: Record<string, TokenInfo[]> = {
  "1": [
    {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Real WETH address
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      priceUsd: 2000,
    },
    {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // Real DAI address
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      priceUsd: 1,
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Real USDC address
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1,
    },
  ],
  "137": [
    {
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // Real WMATIC address
      symbol: "WMATIC",
      name: "Wrapped Matic",
      decimals: 18,
      priceUsd: 0.8,
    },
    {
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // Real USDC on Polygon
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1,
    },
  ],
};

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
  const list = TOKENS[chainId] || [];
  const filtered = list.filter((t) =>
    search
      ? (t.symbol + t.name + t.address)
          .toLowerCase()
          .includes(search.toLowerCase())
      : true,
  );
  const items = filtered.slice(offset, offset + limit);
  return { total: filtered.length, items };
}

/**
 * Find a token by symbol or address.
 */
export function findToken(
  chainId: string,
  tokenIdentifier: string,
): TokenInfo | null {
  const list = TOKENS[chainId] || [];
  return (
    list.find(
      (t) =>
        t.symbol.toLowerCase() === tokenIdentifier.toLowerCase() ||
        t.address.toLowerCase() === tokenIdentifier.toLowerCase(),
    ) || null
  );
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

  // Handle special case for native tokens (ETH, PLS, MATIC)
  const nativeSymbols = ["ETH", "PLS", "MATIC", "PULSE"];
  const isSellNative = nativeSymbols.includes(sellToken.toUpperCase());
  const isBuyNative = nativeSymbols.includes(buyToken.toUpperCase());

  let tokenIn = sell ? sell.address : sellToken;
  let tokenOut = buy ? buy.address : buyToken;

  if (isSellNative) tokenIn = sellToken.toLowerCase();
  if (isBuyNative) tokenOut = buyToken.toLowerCase();

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
