import { z } from "zod";

export const swapBuildSchema = z.object({
  sellToken: z.string().min(1, "Sell token is required"),
  buyToken: z.string().min(1, "Buy token is required"),
  sellAmount: z.string().regex(/^\d+$/, "Sell amount must be a numeric string"),
  recipient: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]{40}$|^[a-zA-Z]{3,5}$/,
      "Invalid recipient address or symbol",
    ),
  fee: z.number().min(0).max(10000).optional(),
  deadline: z.number().positive().optional(),
  slippage: z.number().min(0).max(10000).optional(),
  route: z.any().optional(),
});

export const swapExecuteSchema = z.object({
  transaction: z.object({
    to: z.string().min(1, "Transaction 'to' is required"),
    data: z.string().min(1, "Transaction 'data' is required"),
    value: z.union([z.string(), z.number()]).optional(),
    gasLimit: z.string().optional(),
  }),
});

export const chainIdParamSchema = z.object({
  chainId: z.string().regex(/^\d+$/, "Chain ID must be a numeric string"),
});
