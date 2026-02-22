/**
 * TransactionWorker - Processes pending transaction jobs
 * Fetches job → calls blockchain adapter → updates DB with tx hash
 *
 * Run as: npx ts-node src/infrastructure/queue/TransactionWorker.ts
 * Or: node dist/infrastructure/queue/TransactionWorker.js
 *
 * NOTE: executeTransaction in BlockchainAdapter throws by design.
 * The actual signing/broadcast will be implemented via viem when provided.
 * This worker structure is ready for that integration.
 */
import logger from "../../core/logger";
import { viemBlockchainAdapter } from "../blockchain";
import { prisma } from "../db";

const POLL_INTERVAL_MS = 5000;

async function processJob(
  id: number,
  transactionId: string,
  chainId: number,
  payload: { to: string; data: string; value: string; gasLimit: string },
): Promise<void> {
  try {
    await prisma.pending_transactions.update({
      where: { id },
      data: { status: "processing" },
    });

    const result = await viemBlockchainAdapter.executeTransaction(
      chainId,
      payload,
    );

    await prisma.pending_transactions.update({
      where: { id },
      data: {
        status: "completed",
        tx_hash: result.txHash,
        updated_at: new Date(),
      },
    });

    logger.info("Transaction executed", {
      transactionId,
      txHash: result.txHash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Transaction execution failed", {
      transactionId,
      error: message,
    });

    await prisma.pending_transactions.update({
      where: { id },
      data: {
        status: "failed",
        error_message: message,
        updated_at: new Date(),
      },
    });
  }
}

async function runWorker(): Promise<void> {
  logger.info("Transaction worker started");

  const poll = async () => {
    try {
      const jobs = await prisma.pending_transactions.findMany({
        where: { status: "pending" },
        take: 5,
        orderBy: { created_at: "asc" },
      });

      for (const job of jobs) {
        const payload = job.payload as {
          to: string;
          data: string;
          value: string;
          gasLimit: string;
        };
        await processJob(job.id, job.transaction_id, job.chain_id, payload);
      }
    } catch (err) {
      logger.error("Worker poll error", { err });
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  };

  poll();
}

if (require.main === module) {
  runWorker().catch((err) => {
    logger.error("Worker fatal error", { err });
    process.exit(1);
  });
}

export { runWorker };
