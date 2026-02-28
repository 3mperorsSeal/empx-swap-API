import type { TokenInfo } from "./types";

/** Port — implemented by StaticTokenRepository (or a future DB-backed one). */
export interface ITokenRepository {
  findBySymbolOrAddress(chainId: string, identifier: string): TokenInfo | null;
  list(
    chainId: string,
    search: string,
    limit: number,
    offset: number,
  ): { total: number; items: TokenInfo[] };
}
