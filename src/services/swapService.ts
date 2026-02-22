import { AppError } from "../core/errors";
import logger from "../core/logger";
import prisma from "../lib/prisma";
import { SmartRouter, SwapBuildRequest } from "../lib/smartRouter";
import { findToken } from "./quoteService";

/**
 * Get partner fee from database
 * Returns the fee in basis points (e.g., 30 = 0.30%)
 */
async function getPartnerFee(apiKey?: string): Promise<number> {
  // Default platform fee: 0.25% = 25 basis points
  const DEFAULT_FEE = 25;

  if (!apiKey) {
    logger.info("No API key provided, using default platform fee", {
      fee: DEFAULT_FEE,
    });
    return DEFAULT_FEE;
  }

  try {
    // Prefix is first 8 chars
    const prefix = apiKey.length > 8 ? apiKey.substring(0, 8) : apiKey;

    const keyRecord = await prisma.api_keys.findFirst({
      where: { key_prefix: prefix, revoked: false },
    });

    if (!keyRecord) {
      logger.warn("API key not found or revoked, using default fee", {
        prefix,
      });
      return DEFAULT_FEE;
    }

    // Tier-based fees
    const tierFees: Record<string, number> = {
      free: 30, // 0.30%
      developer: 25, // 0.25%
      pro: 20, // 0.20%
    };

    const tierFee = tierFees[keyRecord.tier] || DEFAULT_FEE;
    logger.info("Using tier-based fee", { tier: keyRecord.tier, fee: tierFee });
    return tierFee;
  } catch (error) {
    logger.error("Error fetching partner fee from database", {
      error: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_FEE;
  }
}

/**
 * Build swap transaction with partner fee support
 *
 * @param chainId - Blockchain chain ID (369, 1, 137, etc.)
 * @param sellToken - Token to sell (address or symbol)
 * @param buyToken - Token to buy (address or symbol)
 * @param sellAmountRaw - Amount to sell in wei
 * @param recipient - Recipient address for the swap
 * @param options - Additional options
 */
export async function buildSwapTransaction(
  chainId: string,
  sellToken: string,
  buyToken: string,
  sellAmountRaw: string,
  recipient: string = "0xUser",
  options?: {
    fee?: number;
    deadline?: number;
    slippage?: number;
    route?: any;
    apiKey?: string;
  },
) {
  const sell = findToken(chainId, sellToken);
  const buy = findToken(chainId, buyToken);

  const tokenIn = sell ? sell.address : sellToken;
  const tokenOut = buy ? buy.address : buyToken;

  const nativeSymbols = ["ETH", "PLS", "MATIC", "PULSE"];
  const isSellNative = nativeSymbols.includes(sellToken.toUpperCase());
  const isBuyNative = nativeSymbols.includes(buyToken.toUpperCase());

  // Validate addresses
  if (!isSellNative && (!tokenIn || !tokenIn.startsWith("0x"))) {
    throw AppError.BadRequest(
      "invalid_sell_token",
      `Invalid sell token: ${sellToken}`,
    );
  }
  if (!isBuyNative && (!tokenOut || !tokenOut.startsWith("0x"))) {
    throw AppError.BadRequest(
      "invalid_buy_token",
      `Invalid buy token: ${buyToken}`,
    );
  }

  // Validate amount
  const sellAmount = BigInt(sellAmountRaw);
  if (sellAmount <= 0n) {
    throw AppError.BadRequest(
      "invalid_amount",
      "Amount must be greater than 0",
    );
  }

  const chainIdNum = parseInt(chainId, 10);

  // Get partner fee
  let fee = options?.fee;
  if (fee === undefined) {
    fee = await getPartnerFee(options?.apiKey);
  }

  // 1. Get the best route (if not provided)
  let route = options?.route;
  if (!route) {
    logger.info("No route provided, calculating best route", {
      chainId,
      tokenIn,
      tokenOut,
    });
    const quote = await SmartRouter.getBestQuote(
      chainIdNum,
      tokenIn,
      tokenOut,
      sellAmount,
    );
    route = quote.route;
  }

  // 2. Build transaction with partner fee
  const buildRequest: SwapBuildRequest = {
    chainId: chainIdNum,
    tokenIn,
    tokenOut,
    amountIn: sellAmount,
    recipient,
    route,
    fee,
    deadline: options?.deadline,
    slippage: options?.slippage || 50, // Default 0.5% slippage
  };

  logger.info("Building swap transaction", {
    chainId: chainIdNum,
    tokenIn,
    tokenOut,
    amountIn: sellAmount.toString(),
    fee,
    routeType: route.type,
  });

  return SmartRouter.buildSwap(buildRequest);
}
