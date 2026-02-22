/**
 * TypeScript types that mirror Solidity contract structs
 * Based on EmpsealRouterLiteV4 specification
 */

/**
 * Hop struct - represents a single hop in a route
 * Mirrors: struct Hop { address adapter; uint256 proportion; bytes data; }
 */
export interface Hop {
  adapter: `0x${string}`;
  proportion: bigint;
  data: `0x${string}`;
}

/**
 * Trade struct - simple single-path trade
 * Mirrors: struct Trade { uint256 amountIn; uint256 amountOut; address[] path; address[] adapters; }
 */
export interface Trade {
  amountIn: bigint;
  amountOut: bigint;
  path: `0x${string}`[];
  adapters: `0x${string}`[];
}

/**
 * SplitPath struct - one path in a split swap
 * Mirrors: struct SplitPath { address[] path; address[] adapters; uint256 proportion; }
 */
export interface SplitPath {
  path: `0x${string}`[];
  adapters: `0x${string}`[];
  proportion: bigint;
}

/**
 * ConvergeTrade struct - two-stage converge trade
 * Mirrors: struct ConvergeTrade {
 *   address tokenIn;
 *   address intermediate;
 *   address tokenOut;
 *   uint256 amountIn;
 *   Hop[] inputHops;
 *   Hop outputHop;
 * }
 */
export interface ConvergeTrade {
  tokenIn: `0x${string}`;
  intermediate: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  inputHops: Hop[];
  outputHop: Hop;
}

/**
 * Helper function to create a Hop with default values
 */
export function createHop(
  adapter: `0x${string}`,
  proportion: number | bigint = 10000n,
  data: `0x${string}` = "0x",
): Hop {
  return {
    adapter,
    proportion:
      typeof proportion === "number" ? BigInt(proportion) : proportion,
    data,
  };
}

/**
 * Helper function to create a Trade
 */
export function createTrade(
  amountIn: bigint,
  amountOut: bigint,
  path: `0x${string}`[],
  adapters: `0x${string}`[],
): Trade {
  return {
    amountIn,
    amountOut,
    path,
    adapters,
  };
}

/**
 * Helper function to create a SplitPath
 */
export function createSplitPath(
  path: `0x${string}`[],
  adapters: `0x${string}`[],
  proportion: number | bigint,
): SplitPath {
  return {
    path,
    adapters,
    proportion:
      typeof proportion === "number" ? BigInt(proportion) : proportion,
  };
}

/**
 * Helper function to create a ConvergeTrade
 */
export function createConvergeTrade(
  tokenIn: `0x${string}`,
  intermediate: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint,
  inputHops: Hop[],
  outputHop: Hop,
): ConvergeTrade {
  return {
    tokenIn,
    intermediate,
    tokenOut,
    amountIn,
    inputHops,
    outputHop,
  };
}
