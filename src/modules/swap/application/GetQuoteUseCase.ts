/**
 * GetQuoteUseCase - Orchestrates quote retrieval
 * Controllers call this; no HTTP concerns here.
 */
import { AppError } from "../../../core/errors";
import type { BlockchainAdapter } from "../../../infrastructure/blockchain/adapters/BlockchainAdapter";
import type { QuoteResult } from "../../../infrastructure/blockchain/adapters/types";
import { findToken } from "../../../services/quoteService";

export interface GetQuoteInput {
  chainId: string;
  sellToken: string;
  buyToken: string;
  sellAmountRaw: string;
  strategy?: "fast" | "best" | "split" | "nosplit" | "converge";
  slippageBps?: number;
}

export interface GetQuoteOutput extends QuoteResult {
  strategyUsed?: string;
}

export class GetQuoteUseCase {
  constructor(private readonly blockchainAdapter: BlockchainAdapter) {}

  async execute(input: GetQuoteInput): Promise<GetQuoteOutput> {
    const {
      chainId,
      sellToken,
      buyToken,
      sellAmountRaw,
      strategy = "best",
      slippageBps,
    } = input;

    const chainIdNum = parseInt(chainId, 10);
    if (isNaN(chainIdNum)) {
      throw AppError.BadRequest(
        "invalid_chain_id",
        `Invalid chain ID: ${chainId}`,
      );
    }

    const sell = findToken(chainId, sellToken);
    const buy = findToken(chainId, buyToken);
    const nativeSymbols = ["ETH", "PLS", "MATIC", "PULSE"];
    const isSellNative = nativeSymbols.includes(sellToken.toUpperCase());
    const isBuyNative = nativeSymbols.includes(buyToken.toUpperCase());

    let tokenIn = sell ? sell.address : sellToken;
    let tokenOut = buy ? buy.address : buyToken;
    if (isSellNative) tokenIn = sellToken.toLowerCase();
    if (isBuyNative) tokenOut = buyToken.toLowerCase();

    if (!sell && !isSellNative && !sellToken.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw AppError.NotFound(
        "token_not_found",
        `Sell token '${sellToken}' not found. Use token address (0x...) or symbol`,
      );
    }
    if (!buy && !isBuyNative && !buyToken.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw AppError.NotFound(
        "token_not_found",
        `Buy token '${buyToken}' not found. Use token address (0x...) or symbol`,
      );
    }

    const sellAmount = BigInt(sellAmountRaw);
    if (sellAmount <= 0n) {
      throw AppError.BadRequest(
        "invalid_amount",
        "Amount must be greater than 0",
      );
    }

    const quote = await this.blockchainAdapter.getQuote({
      chainId: chainIdNum,
      tokenIn,
      tokenOut,
      amountIn: sellAmount,
      strategy,
    });

    // Apply custom slippage if provided (business rule)
    let amountOutMinStr = quote.amountOutMin;
    if (slippageBps !== undefined && slippageBps > 0 && quote.amountOut) {
      const amountOut = BigInt(quote.amountOut);
      const amountOutMin = (amountOut * BigInt(10000 - slippageBps)) / 10000n;
      amountOutMinStr = amountOutMin.toString();
    }

    return {
      ...quote,
      amountOutMin: amountOutMinStr,
      strategyUsed: strategy,
    };
  }
}
