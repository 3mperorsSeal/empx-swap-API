/**
 * TransactionQueue - Enqueue transaction jobs for async execution
 * Uses in-memory queue when Redis unavailable; can be swapped for BullMQ.
 */
import { v4 as uuidv4 } from "uuid";
import logger from "../../core/logger";
import { prisma } from "../db";

export interface TransactionJobPayload {
  chainId: number;
  to: string;
  data: string;
  value: string;
  gasLimit: string;
}

/**
 * Store pending transaction and return transaction_id.
 * Worker will poll pending_transactions and process.
 */
export async function enqueueTransactionJob(
  payload: TransactionJobPayload,
): Promise<string> {
  const transactionId = uuidv4();

  await prisma.pending_transactions.create({
    data: {
      transaction_id: transactionId,
      chain_id: payload.chainId,
      payload: payload as unknown as object,
      status: "pending",
    },
  });

  logger.info("Transaction job enqueued", {
    transactionId,
    chainId: payload.chainId,
  });

  return transactionId;
}
