/**
 * BuildTransactionUseCase - Orchestrates swap transaction building
 * Uses BlockchainAdapter; no viem imports.
 */
import type { BlockchainAdapter } from "../../../infrastructure/blockchain/adapters/BlockchainAdapter";
import { findToken } from "../../../services/quoteService";

import { AppError } from "../../../core/errors";
import prisma from "../../../lib/prisma";

async function getPartnerFee(apiKey?: string): Promise<number> {
  const DEFAULT_FEE = 25;
  if (!apiKey) return DEFAULT_FEE;

  const prefix = apiKey.length > 8 ? apiKey.substring(0, 8) : apiKey;
  const keyRecord = await prisma.api_keys.findFirst({
    where: { key_prefix: prefix, revoked: false },
  });
  if (!keyRecord) return DEFAULT_FEE;

  const tierFees: Record<string, number> = {
    free: 30,
    developer: 25,
    pro: 20,
  };
  return tierFees[keyRecord.tier] || DEFAULT_FEE;
}

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
  constructor(private readonly blockchainAdapter: BlockchainAdapter) {}

  async execute(input: BuildTransactionInput) {
    const sell = findToken(input.chainId, input.sellToken);
    const buy = findToken(input.chainId, input.buyToken);
    const tokenIn = sell ? sell.address : input.sellToken;
    const tokenOut = buy ? buy.address : input.buyToken;

    const nativeSymbols = ["ETH", "PLS", "MATIC", "PULSE"];
    const isSellNative = nativeSymbols.includes(input.sellToken.toUpperCase());
    const isBuyNative = nativeSymbols.includes(input.buyToken.toUpperCase());

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

    let route = input.route;
    if (!route) {
      const quote = await this.blockchainAdapter.getQuote({
        chainId: chainIdNum,
        tokenIn,
        tokenOut,
        amountIn: sellAmount,
        strategy: "best",
      });
      route = quote.route;
    }

    return this.blockchainAdapter.buildTransaction({
      chainId: chainIdNum,
      tokenIn,
      tokenOut,
      amountIn: sellAmount,
      recipient: input.recipient || "0xUser",
      route:
        route as import("../../../infrastructure/blockchain/adapters/types").Route,
      fee,
      deadline: input.deadline,
      slippage: input.slippage ?? 50,
    });
  }
}
