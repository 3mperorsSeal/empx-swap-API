import { NextFunction, Request, Response } from "express";
import { AppError } from "../../core/errors";
import * as service from "./service";

/**
 * Get a fast quote estimate.
 * Controller: parse request → call UseCase → return response
 */
export async function quoteFast(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { chainId } = req.params;
    const { sellToken, buyToken, sellAmount, slippage } = req.query as Record<
      string,
      string
    >;

    if (!(await service.ensureChain(chainId))) {
      throw AppError.NotFound(
        "chain_not_found",
        `Chain ${chainId} not supported`,
      );
    }

    // GANADESH HAS TO IMPLEMENT FAST QUOTE HERE
    const quote = await service.estimateWithUseCase({
      chainId,
      sellToken,
      buyToken,
      sellAmountRaw: sellAmount,
      strategy: "fast",
      slippage,
    });

    res.json({ requestId: req.requestId, ...quote });
  } catch (err) {
    next(err);
  }
}

/**
 * Get the best quote estimate using various strategies.
 */
export async function quoteBest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { chainId } = req.params;
    const { sellToken, buyToken, sellAmount, strategy, slippage } =
      req.query as Record<string, string>;

    if (!(await service.ensureChain(chainId))) {
      throw AppError.NotFound(
        "chain_not_found",
        `Chain ${chainId} not supported`,
      );
    }

    // GANADESH HAS TO IMPLEMENT BEST QUOTE HERE
    const usedStrategy = service.resolveStrategy(strategy, "best");
    const quote = await service.estimateWithUseCase({
      chainId,
      sellToken,
      buyToken,
      sellAmountRaw: sellAmount,
      strategy: usedStrategy,
      slippage,
    });

    res.json({
      requestId: req.requestId,
      ...quote,
      strategyUsed: usedStrategy,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get multiple quote estimates in a single request.
 */
export async function quoteBatch(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { chainId } = req.params;
    const { quotes } = req.body;

    if (!(await service.ensureChain(chainId))) {
      throw AppError.NotFound(
        "chain_not_found",
        `Chain ${chainId} not supported`,
      );
    }

    const results = await Promise.all(
      quotes.map(
        async (q: {
          sellToken: string;
          buyToken: string;
          sellAmount: string;
          strategy?: string;
        }) => {
          try {
            const quote = await service.estimateWithUseCase({
              chainId,
              sellToken: q.sellToken,
              buyToken: q.buyToken,
              sellAmountRaw: q.sellAmount,
              strategy: service.resolveStrategy(q.strategy, "fast"),
            });
            return { ok: true, ...quote };
          } catch (e: unknown) {
            return {
              ok: false,
              error: e instanceof Error ? e.message : "quote_failed",
            };
          }
        },
      ),
    );
    res.json({ requestId: req.requestId, results });
  } catch (err) {
    next(err);
  }
}
