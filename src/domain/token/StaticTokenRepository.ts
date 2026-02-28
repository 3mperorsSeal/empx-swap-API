/**
 * StaticTokenRepository — in-memory token list.
 * Replace with a DB-backed implementation (Phase 7) when ready.
 */
import type { ITokenRepository } from "./ITokenRepository";
import type { TokenInfo } from "./types";

const TOKENS: Record<string, TokenInfo[]> = {
  "1": [
    {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      priceUsd: 2000,
    },
    {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      priceUsd: 1,
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1,
    },
  ],
  "137": [
    {
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      symbol: "WMATIC",
      name: "Wrapped Matic",
      decimals: 18,
      priceUsd: 0.8,
    },
    {
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1,
    },
  ],
};

class StaticTokenRepositoryImpl implements ITokenRepository {
  findBySymbolOrAddress(chainId: string, identifier: string): TokenInfo | null {
    const list = TOKENS[chainId] ?? [];
    return (
      list.find(
        (t) =>
          t.symbol.toLowerCase() === identifier.toLowerCase() ||
          t.address.toLowerCase() === identifier.toLowerCase(),
      ) ?? null
    );
  }

  list(
    chainId: string,
    search: string,
    limit: number,
    offset: number,
  ): { total: number; items: TokenInfo[] } {
    const all = TOKENS[chainId] ?? [];
    const filtered = search
      ? all.filter((t) =>
          (t.symbol + t.name + t.address)
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
      : all;
    return {
      total: filtered.length,
      items: filtered.slice(offset, offset + limit),
    };
  }
}

export const staticTokenRepository: ITokenRepository =
  new StaticTokenRepositoryImpl();
