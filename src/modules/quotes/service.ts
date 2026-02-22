import { getQuoteUseCase } from "../../application/container";
import { AppError } from "../../core/errors";
import { Strategy } from "../../lib/smartRouter";
import { listTokens, quoteEstimate } from "../../services/quoteService";
import * as chainsService from "../chains/service";

type QuoteStrategy = "fast" | "best" | "split" | "nosplit" | "converge";

const STRATEGIES = new Set<QuoteStrategy>([
  "fast",
  "best",
  "split",
  "nosplit",
  "converge",
]);

export async function ensureChain(chainId: string) {
  return chainsService.getChain(chainId);
}

export async function estimate(
  chainId: string,
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  strategy: Strategy = "best",
) {
  return quoteEstimate(chainId, sellToken, buyToken, sellAmount, strategy);
}

export function resolveStrategy(
  strategy: string | undefined,
  fallback: QuoteStrategy,
): QuoteStrategy {
  const normalized = (strategy || fallback) as QuoteStrategy;
  if (!STRATEGIES.has(normalized)) {
    throw AppError.BadRequest(
      "invalid_strategy",
      `Unsupported strategy '${strategy}'`,
    );
  }
  return normalized;
}

export function resolveSlippageBps(
  slippage: string | undefined,
): number | undefined {
  if (!slippage) return undefined;
  const slippageBps = Number(slippage);
  if (
    !Number.isFinite(slippageBps) ||
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > 10_000
  ) {
    throw AppError.BadRequest(
      "invalid_slippage",
      "Slippage must be an integer between 0 and 10000 bps",
    );
  }
  return slippageBps;
}

export async function estimateWithUseCase(input: {
  chainId: string;
  sellToken: string;
  buyToken: string;
  sellAmountRaw: string;
  strategy: QuoteStrategy;
  slippage?: string;
}) {
  return getQuoteUseCase.execute({
    chainId: input.chainId,
    sellToken: input.sellToken,
    buyToken: input.buyToken,
    sellAmountRaw: input.sellAmountRaw,
    strategy: input.strategy,
    slippageBps: resolveSlippageBps(input.slippage),
  });
}

export function list(chainId: string, search = "", limit = 25, offset = 0) {
  return listTokens(chainId, search, limit, offset);
}
