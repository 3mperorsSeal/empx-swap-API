/**
 * BlockchainAdapter - Interface for all blockchain interactions
 * Controllers and services MUST NEVER import viem directly.
 * All blockchain results are normalized into this interface.
 */
import type {
  BuildTransactionInput,
  BuildTransactionResult,
  ExecuteTransactionResult,
  GasEstimateResult,
  QuoteResult,
} from "./types";

export interface GetQuoteInput {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  strategy?: "fast" | "best" | "split" | "nosplit" | "converge";
}

export interface BlockchainAdapter {
  getQuote(input: GetQuoteInput): Promise<QuoteResult>;
  buildTransaction(
    input: BuildTransactionInput,
  ): Promise<BuildTransactionResult>;
  estimateGas(
    chainId: number,
    transaction: { to: string; data: string; value: string },
  ): Promise<GasEstimateResult>;
  executeTransaction(
    chainId: number,
    transaction: { to: string; data: string; value: string; gasLimit: string },
  ): Promise<ExecuteTransactionResult>;
}
