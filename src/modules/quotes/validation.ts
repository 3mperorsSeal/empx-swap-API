import { z } from "zod";

export const chainIdParamSchema = z.object({
  chainId: z.string().regex(/^\d+$/, "Chain ID must be a numeric string"),
});

export const quoteQuerySchema = z.object({
  sellToken: z.string().min(1, "Sell token is required"),
  buyToken: z.string().min(1, "Buy token is required"),
  sellAmount: z.string().regex(/^\d+$/, "Sell amount must be a numeric string"),
  slippage: z.string().regex(/^\d*$/).optional(),
  strategy: z.enum(["fast", "best", "split", "nosplit", "converge"]).optional(),
});

export const quoteBatchSchema = z.object({
  quotes: z
    .array(
      z.object({
        sellToken: z.string().min(1),
        buyToken: z.string().min(1),
        sellAmount: z.string().regex(/^\d+/),
        strategy: z
          .enum(["fast", "best", "split", "nosplit", "converge"])
          .optional(),
      }),
    )
    .min(1, "At least one quote is required"),
});
