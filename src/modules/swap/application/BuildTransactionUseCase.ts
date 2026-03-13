/**
 * BuildTransactionUseCase - Orchestrates swap transaction building
 * Uses BlockchainAdapter; no viem imports.
 */
import { AppError } from "../../../core/errors";
import { getPartnerFee } from "../../../domain/fee/FeePolicy";
import type { ITokenRepository } from "../../../domain/token/ITokenRepository";
import {
  isNativeToken,
  resolveTokenInput,
} from "../../../domain/token/NativeTokens";
import type { BlockchainAdapter } from "../../../infrastructure/blockchain/adapters/BlockchainAdapter";

export interface BuildTransactionInput {
  chainId: string;
  sellToken: string;
  buyToken: string;
  sellAmountRaw: string;
  recipient?: string;
  fee?: number;
  deadline?: number;
  slippage?: number;
  route?: unknown;
  apiKey?: string;
}

export class BuildTransactionUseCase {
  constructor(
    private readonly blockchainAdapter: BlockchainAdapter,
    private readonly tokenRepo: ITokenRepository,
  ) {}

  async execute(input: BuildTransactionInput) {
    const sell = this.tokenRepo.findBySymbolOrAddress(
      input.chainId,
      input.sellToken,
    );
    const buy = this.tokenRepo.findBySymbolOrAddress(
      input.chainId,
      input.buyToken,
    );
    const isSellNative = isNativeToken(input.sellToken);
    const isBuyNative = isNativeToken(input.buyToken);

    const tokenIn = resolveTokenInput(sell, input.sellToken, isSellNative);
    const tokenOut = resolveTokenInput(buy, input.buyToken, isBuyNative);

    if (!isSellNative && (!tokenIn || !tokenIn.startsWith("0x"))) {
      throw AppError.BadRequest(
        "invalid_sell_token",
        `Invalid sell token: ${input.sellToken}`,
      );
    }
    if (!isBuyNative && (!tokenOut || !tokenOut.startsWith("0x"))) {
      throw AppError.BadRequest(
        "invalid_buy_token",
        `Invalid buy token: ${input.buyToken}`,
      );
    }

    const sellAmount = BigInt(input.sellAmountRaw);
    if (sellAmount <= 0n) {
      throw AppError.BadRequest(
        "invalid_amount",
        "Amount must be greater than 0",
      );
    }

    const chainIdNum = parseInt(input.chainId, 10);
    if (isNaN(chainIdNum)) {
      throw AppError.BadRequest(
        "invalid_chain_id",
        `Invalid chain ID: ${input.chainId}`,
      );
    }

    let fee = input.fee;
    if (fee === undefined) {
      fee = await getPartnerFee(input.apiKey);
    }

    if (!input.recipient) {
      throw AppError.BadRequest(
        "missing_recipient",
        "recipient address is required",
      );
    }

    let route = input.route;
    if (!route) {
      const quote = await this.blockchainAdapter.getQuote({
        chainId: chainIdNum,
        tokenIn,
        tokenOut,
        amountIn: sellAmount,
        strategy: "nosplit", // "best"/"converge"/"split" are not yet wired to real on-chain data
      });
      route = quote.route;
    }

    return this.blockchainAdapter.buildTransaction({
      chainId: chainIdNum,
      tokenIn,
      tokenOut,
      amountIn: sellAmount,
      recipient: input.recipient,
      route:
        route as import("../../../infrastructure/blockchain/adapters/types").Route,
      fee,
      deadline: input.deadline,
      slippage: input.slippage ?? 15,
    });
  }
}
