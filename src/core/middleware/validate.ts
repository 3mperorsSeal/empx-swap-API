import { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { AppError } from "../errors";

/**
 * Validates request body against a Zod schema.
 */
export function validateBody(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          AppError.BadRequest(
            "invalid_request",
            "Invalid request body",
            error.issues,
          ),
        );
      }
      next(error);
    }
  };
}

/**
 * Validates request query parameters against a Zod schema.
 */
export function validateQuery(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          AppError.BadRequest(
            "invalid_query",
            "Invalid query parameters",
            error.issues,
          ),
        );
      }
      next(error);
    }
  };
}

/**
 * Validates request parameters against a Zod schema.
 */
export function validateParams(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          AppError.BadRequest(
            "invalid_params",
            "Invalid path parameters",
            error.issues,
          ),
        );
      }
      next(error);
    }
  };
}
