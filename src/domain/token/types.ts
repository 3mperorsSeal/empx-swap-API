/** Core token value-object used throughout the domain. */
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Mock USD price — replace with live feed in production. */
  priceUsd: number;
}
