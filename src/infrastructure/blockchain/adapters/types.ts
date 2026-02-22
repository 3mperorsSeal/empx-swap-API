/**
 * Normalized blockchain response types
 * All adapters must return these formats - no viem types leak.
 */

export type RouteType = "NOSPLIT" | "SPLIT" | "CONVERGE" | "WRAP" | "UNWRAP";

export interface RouteHop {
  adapter: string;
  proportion: number;
  data?: string;
}

export interface Route {
  type: RouteType;
  path?: string[];
  adapters?: string[];
  intermediate?: string;
  inputHops?: RouteHop[];
  outputHop?: RouteHop;
  splitPaths?: Array<{
    path: string[];
    adapters: string[];
    proportion: number;
  }>;
}

export interface QuoteResult {
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  route: Route;
  priceImpact: number;
  meta: {
    quotedAt: number;
    chainId: number;
    computationTime?: number;
  };
}

export interface BuildTransactionInput {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  recipient: string;
  route: Route;
  fee?: number;
  deadline?: number;
  slippage?: number;
}

export interface BuildTransactionResult {
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    chainId: number;
  };
  approval: {
    required: boolean;
    token?: string;
    spender?: string;
    amount?: string;
    transaction?: {
      to: string;
      data: string;
      value: string;
    };
  };
  meta: {
    builtAt: number;
    expiresAt: number;
  };
}

export interface GasEstimateResult {
  gasLimit: string;
  gasPrice?: string;
}

export interface ExecuteTransactionResult {
  txHash: string;
  status: "pending" | "confirmed" | "failed";
}
