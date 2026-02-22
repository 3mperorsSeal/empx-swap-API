/**
 * IdempotencyRepository - Store and retrieve idempotency keys
 */
import { prisma } from "./index";

const DEFAULT_TTL_HOURS = 24;

export interface IdempotencyRecord {
  idempotencyKey: string;
  requestHash: string | null;
  storedResponse: unknown;
  status: string;
}

export async function findIdempotencyRecord(
  idempotencyKey: string,
): Promise<IdempotencyRecord | null> {
  const record = await prisma.idempotency_keys.findUnique({
    where: { idempotency_key: idempotencyKey },
  });
  if (!record) return null;
  return {
    idempotencyKey: record.idempotency_key,
    requestHash: record.request_hash,
    storedResponse: record.stored_response as unknown,
    status: record.status,
  };
}

export async function storeIdempotencyRecord(
  idempotencyKey: string,
  requestHash: string,
  storedResponse: unknown,
  status: "completed" | "pending" = "completed",
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + DEFAULT_TTL_HOURS);

  await prisma.idempotency_keys.upsert({
    where: { idempotency_key: idempotencyKey },
    create: {
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      stored_response: storedResponse as object,
      status,
      expires_at: expiresAt,
    },
    update: {
      request_hash: requestHash,
      stored_response: storedResponse as object,
      status,
      expires_at: expiresAt,
    },
  });
}
