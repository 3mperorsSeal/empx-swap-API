import { AppError } from "../core/errors";
import logger from "../core/logger";
import { getPartnerFee } from "../domain/fee/FeePolicy";
import { isNativeToken, resolveTokenInput } from "../domain/token/NativeTokens";
import { staticTokenRepository } from "../domain/token/StaticTokenRepository";
import { SmartRouter, SwapBuildRequest } from "../lib/smartRouter";

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
  const sell = staticTokenRepository.findBySymbolOrAddress(chainId, sellToken);
  const buy = staticTokenRepository.findBySymbolOrAddress(chainId, buyToken);
  const isSellNative = isNativeToken(sellToken);
  const isBuyNative = isNativeToken(buyToken);

  const tokenIn = resolveTokenInput(sell, sellToken, isSellNative);
  const tokenOut = resolveTokenInput(buy, buyToken, isBuyNative);

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
      "nosplit", // "best" / "converge" / "split" are not yet wired to real on-chain data
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
