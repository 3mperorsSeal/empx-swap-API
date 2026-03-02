import { NextFunction, Request, Response } from "express";
import { buildTransactionUseCase } from "../../application/container";
import { AppError } from "../../core/errors";
import { storeIdempotencyResponse } from "../../core/middleware/idempotency";
import { enqueueTransactionJob } from "../../infrastructure/queue";
import * as service from "./service";

/**
 * Build a swap transaction.
 * Controller: parse request → call UseCase → return response
 */
export async function swapBuild(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { chainId } = req.params;
    const {
      sellToken,
      buyToken,
      sellAmount,
      recipient,
      fee,
      deadline,
      slippage,
      route,
    } = req.body;

    if (!(await service.ensureChain(chainId))) {
      throw AppError.NotFound(
        "chain_not_found",
        `Chain ${chainId} not supported`,
      );
    }

    const apiKey =
      req.apiKey?.key_prefix || (req.headers["x-api-key"] as string);

    // GANADESH HAS TO IMPLEMENT SWAP BUILD HERE
    const tx = await buildTransactionUseCase.execute({
      chainId,
      sellToken,
      buyToken,
      sellAmountRaw: String(sellAmount),
      recipient,
      fee: fee !== undefined ? Number(fee) : undefined,
      deadline: deadline ? Number(deadline) : undefined,
      slippage: slippage !== undefined ? Number(slippage) : undefined,
      route,
      apiKey,
    });

    res.json({ requestId: req.requestId, ...tx });
  } catch (err) {
    next(err);
  }
}

/**
 * Execute a swap transaction asynchronously (queue-based).
 * Requires Idempotency-Key header.
 * Returns transaction_id for polling status.
 */
export async function swapExecute(
  req: Request & { idempotencyKey?: string },
  res: Response,
  next: NextFunction,
) {
  try {
    const { chainId } = req.params;
    const { transaction } = req.body as {
      transaction: {
        to: string;
        data: string;
        value: string;
        gasLimit: string;
      };
    };

    if (!(await service.ensureChain(chainId))) {
      throw AppError.NotFound(
        "chain_not_found",
        `Chain ${chainId} not supported`,
      );
    }

    if (
      !transaction ||
      !transaction.to ||
      !transaction.data ||
      transaction.value === undefined
    ) {
      throw AppError.BadRequest(
        "invalid_transaction",
        "Body must include transaction: { to, data, value, gasLimit }",
      );
    }

    const chainIdNum = parseInt(chainId, 10);
    const payload = {
      chainId: chainIdNum,
      to: transaction.to,
      data: transaction.data,
      value: String(transaction.value ?? "0"),
      gasLimit: transaction.gasLimit || "200000",
    };

    const transactionId = await enqueueTransactionJob(payload);

    const response = {
      requestId: req.requestId,
      transaction_id: transactionId,
      status: "pending",
      message: "Transaction queued for execution",
    };

    await storeIdempotencyResponse(req, response);
    // GANADESH HAS TO IMPLEMENT SWAP EXECUTE HERE
    res.json(response);
  } catch (err) {
    next(err);
  }
}
