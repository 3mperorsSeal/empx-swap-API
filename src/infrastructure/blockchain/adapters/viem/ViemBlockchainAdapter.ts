/**
 * ViemBlockchainAdapter - Wraps all viem/SmartRouter calls
 * Controllers and services MUST NEVER import viem or SmartRouter directly.
 * All results are normalized to BlockchainAdapter types.
 */
import logger from "../../../../core/logger";
import { SmartRouter } from "../../../../lib/smartRouter";
import type { BlockchainAdapter, GetQuoteInput } from "../BlockchainAdapter";
import type {
  BuildTransactionInput,
  BuildTransactionResult,
  ExecuteTransactionResult,
  GasEstimateResult,
  QuoteResult,
} from "../types";

export class ViemBlockchainAdapter implements BlockchainAdapter {
  async getQuote(input: GetQuoteInput): Promise<QuoteResult> {
    const strategy = input.strategy ?? "nosplit"; // "best"/"converge"/"split" not yet implemented
    const result = await SmartRouter.getBestQuote(
      input.chainId,
      input.tokenIn,
      input.tokenOut,
      input.amountIn,
      strategy,
    );
    return {
      amountIn: result.amountIn,
      amountOut: result.amountOut,
      amountOutMin: result.amountOutMin,
      route: result.route,
      priceImpact: result.priceImpact,
      meta: result.meta,
    };
  }

  async buildTransaction(
    input: BuildTransactionInput,
  ): Promise<BuildTransactionResult> {
    const result = await SmartRouter.buildSwap({
      chainId: input.chainId,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amountIn: input.amountIn,
      recipient: input.recipient,
      route: input.route,
      fee: input.fee,
      deadline: input.deadline,
      slippage: input.slippage,
    });
    return result;
  }

  async estimateGas(
    chainId: number,
    transaction: { to: string; data: string; value: string },
  ): Promise<GasEstimateResult> {
    // SmartRouter uses static gas for now; viem estimateGas can be added later
    logger.debug("estimateGas called", { chainId });
    return {
      gasLimit: "200000",
    };
  }

  async executeTransaction(
    chainId: number,
    transaction: { to: string; data: string; value: string; gasLimit: string },
  ): Promise<ExecuteTransactionResult> {
    // Execution is delegated to queue worker - this is for direct execution if needed
    // In production, the worker will call the blockchain; this adapter can support
    // a wallet/signer for testing or admin flows.
    logger.warn(
      "executeTransaction: Use queue worker for production execution",
      {
        chainId,
      },
    );
    throw new Error(
      "executeTransaction: Blockchain execution must go through queue worker",
    );
  }
}
