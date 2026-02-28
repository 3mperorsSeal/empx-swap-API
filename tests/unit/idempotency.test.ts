/**
 * Idempotency middleware unit tests — verifies duplicate-key semantics.
 * These must pass after every refactor phase.
 */

jest.mock("../../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    idempotency_keys: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../src/infrastructure/db/IdempotencyRepository", () => ({
  findIdempotencyRecord: jest.fn(),
  storeIdempotencyRecord: jest.fn(),
}));

import { createRequest, createResponse } from "node-mocks-http";
import {
  requireIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResponse,
  computeRequestHash,
} from "../../src/core/middleware/idempotency";
import * as IdempotencyRepository from "../../src/infrastructure/db/IdempotencyRepository";

describe("requireIdempotencyKey middleware", () => {
  afterEach(() => jest.resetAllMocks());

  it("passes to next() when Idempotency-Key header is present", () => {
    const req = createRequest({ headers: { "Idempotency-Key": "my-key-123" } });
    const res = createResponse();
    const next = jest.fn();

    requireIdempotencyKey(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).idempotencyKey).toBe("my-key-123");
  });

  it("returns 400 when Idempotency-Key header is missing", () => {
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    requireIdempotencyKey(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    const body = res._getJSONData();
    expect(body).toHaveProperty("error", "missing_idempotency_key");
  });

  it("returns 400 when Idempotency-Key exceeds 64 characters", () => {
    const longKey = "a".repeat(65);
    const req = createRequest({ headers: { "Idempotency-Key": longKey } });
    const res = createResponse();
    const next = jest.fn();

    requireIdempotencyKey(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    const body = res._getJSONData();
    expect(body).toHaveProperty("error", "invalid_idempotency_key");
  });
});

describe("checkIdempotency middleware", () => {
  afterEach(() => jest.resetAllMocks());

  it("returns stored response immediately for completed duplicate key", async () => {
    const storedResponse = { transaction_id: "tx-999", status: "pending" };
    (
      IdempotencyRepository.findIdempotencyRecord as jest.Mock
    ).mockResolvedValue({
      idempotencyKey: "dup-key",
      requestHash: "hash123",
      storedResponse,
      status: "completed",
    });

    const req = createRequest({ headers: { "Idempotency-Key": "dup-key" } });
    (req as any).idempotencyKey = "dup-key";
    const res = createResponse();
    const next = jest.fn();

    await checkIdempotency(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    const body = res._getJSONData();
    expect(body).toEqual(storedResponse);
  });

  it("passes to next() when key is not found (first call)", async () => {
    (
      IdempotencyRepository.findIdempotencyRecord as jest.Mock
    ).mockResolvedValue(null);

    const req = createRequest({
      method: "POST",
      path: "/v1/swap/1/execute",
      body: { transaction: { to: "0x123", data: "0x", value: "0" } },
    });
    (req as any).idempotencyKey = "new-key-xyz";
    const res = createResponse();
    const next = jest.fn();

    await checkIdempotency(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("passes to next() when no idempotencyKey on request", async () => {
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    await checkIdempotency(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(IdempotencyRepository.findIdempotencyRecord).not.toHaveBeenCalled();
  });
});

describe("computeRequestHash()", () => {
  it("produces a deterministic 64-char hex string", () => {
    const req = createRequest({
      method: "POST",
      path: "/v1/swap/1/execute",
      body: { transaction: { to: "0x123" } },
    });

    const hash1 = computeRequestHash(req as any);
    const hash2 = computeRequestHash(req as any);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]+$/);
  });

  it("produces different hashes for different request bodies", () => {
    const req1 = createRequest({ method: "POST", body: { a: 1 } });
    const req2 = createRequest({ method: "POST", body: { a: 2 } });

    expect(computeRequestHash(req1 as any)).not.toBe(
      computeRequestHash(req2 as any),
    );
  });
});

describe("storeIdempotencyResponse()", () => {
  afterEach(() => jest.resetAllMocks());

  it("stores the response when key and hash are present", async () => {
    (
      IdempotencyRepository.storeIdempotencyRecord as jest.Mock
    ).mockResolvedValue(undefined);

    const req = createRequest();
    (req as any).idempotencyKey = "my-key";
    (req as any).idempotencyRequestHash = "myhash123";

    await storeIdempotencyResponse(req as any, { ok: true });

    expect(IdempotencyRepository.storeIdempotencyRecord).toHaveBeenCalledWith(
      "my-key",
      "myhash123",
      { ok: true },
      "completed",
    );
  });

  it("does nothing when idempotencyKey is missing", async () => {
    const req = createRequest();
    await storeIdempotencyResponse(req as any, { ok: true });
    expect(IdempotencyRepository.storeIdempotencyRecord).not.toHaveBeenCalled();
  });
});
