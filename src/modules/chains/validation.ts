import { z } from "zod";

export const chainIdParamSchema = z.object({
  chainId: z.string().regex(/^\d+$/, "Chain ID must be a numeric string"),
});

export const tokensQuerySchema = z.object({
  search: z.string().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(500))
    .optional(),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0))
    .optional(),
});
