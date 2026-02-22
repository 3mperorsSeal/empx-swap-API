# Enterprise Architecture — Refactoring Summary

## 1. Updated Folder Structure

```
src/
├── core/
│   ├── config/
│   ├── logger/
│   ├── errors/
│   └── middleware/
│       ├── idempotency.ts
│       └── apiKeyUsage.ts
├── modules/
│   ├── swap/
│   │   ├── application/
│   │   │   └── GetQuoteUseCase.ts
│   │   ├── domain/
│   │   └── infrastructure/
│   ├── transaction/
│   │   ├── application/
│   │   │   └── BuildTransactionUseCase.ts
│   │   ├── domain/
│   │   └── infrastructure/
│   ├── partner/
│   ├── subscription/
│   └── auth/
├── infrastructure/
│   ├── blockchain/
│   │   └── adapters/
│   │       ├── BlockchainAdapter.ts
│   │       ├── types.ts
│   │       └── viem/
│   │           └── ViemBlockchainAdapter.ts
│   ├── db/
│   │   ├── index.ts
│   │   └── IdempotencyRepository.ts
│   ├── cache/
│   └── queue/
│       ├── TransactionQueue.ts
│       └── TransactionWorker.ts
├── interfaces/
│   └── http/
│       ├── controllers/
│       ├── routes/
│       └── validators/
├── application/
│   └── container.ts
└── shared/
```

## 2. Example Refactored Swap Quote Endpoint

**Flow:** Controller → GetQuoteUseCase → BlockchainAdapter (ViemBlockchainAdapter)

```typescript
// src/modules/quotes/controller.ts
export async function quoteFast(req, res, next) {
  const { chainId } = req.params;
  const { sellToken, buyToken, sellAmount, slippage } = req.query;
  if (!(await service.ensureChain(chainId))) throw AppError.NotFound(...);
  const quote = await getQuoteUseCase.execute({
    chainId, sellToken, buyToken, sellAmountRaw: sellAmount,
    strategy: "fast", slippageBps: slippage ? Number(slippage) : undefined,
  });
  res.json({ requestId: req.requestId, ...quote });
}
```

## 3. Blockchain Adapter Implementation

```typescript
// src/infrastructure/blockchain/adapters/BlockchainAdapter.ts
export interface BlockchainAdapter {
  getQuote(input: GetQuoteInput): Promise<QuoteResult>;
  buildTransaction(input: BuildTransactionInput): Promise<BuildTransactionResult>;
  estimateGas(...): Promise<GasEstimateResult>;
  executeTransaction(...): Promise<ExecuteTransactionResult>;
}

// src/infrastructure/blockchain/adapters/viem/ViemBlockchainAdapter.ts
export class ViemBlockchainAdapter implements BlockchainAdapter {
  async getQuote(input) {
    return SmartRouter.getBestQuote(...); // Wraps viem/SmartRouter
  }
  async buildTransaction(input) {
    return SmartRouter.buildSwap(...);
  }
  // ...
}
```

Controllers and services **never** import viem or SmartRouter directly.

## 4. Example UseCase Class

```typescript
// src/modules/swap/application/GetQuoteUseCase.ts
export class GetQuoteUseCase {
  constructor(private readonly blockchainAdapter: BlockchainAdapter) {}
  async execute(input: GetQuoteInput): Promise<GetQuoteOutput> {
    // Token resolution, validation, slippage logic
    const quote = await this.blockchainAdapter.getQuote({...});
    return { ...quote, amountOutMin: amountOutMinStr, strategyUsed: strategy };
  }
}
```

## 5. Example Queue Worker

```typescript
// src/infrastructure/queue/TransactionWorker.ts
async function processJob(id, transactionId, chainId, payload) {
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
    data: { status: "completed", tx_hash: result.txHash },
  });
}
// Run: npx ts-node src/infrastructure/queue/TransactionWorker.ts
```

**Note:** `executeTransaction` currently throws — implement viem signing/broadcast when provided.

## 6. Idempotency for Execution

- `POST /v1/swap/:chainId/execute` requires `Idempotency-Key` header
- Duplicate keys return stored response; no re-execution
- Tables: `idempotency_keys` (idempotency_key, request_hash, stored_response, status)

## 7. Enterprise API Key Usage Logging

- Middleware: `apiKeyUsageLogger` logs to `partner_usage_logs`
- Fields: api_key_id, endpoint, method, status, duration_ms
- Applied to all `/v1/*` protected routes

## 8. Structured Logger

- Existing `requestLogger` logs: requestId, path, method, status, duration_ms, apiKeyId
- Error handler logs: requestId, code, details, stack

## 9. Validation Layer

- Existing Zod schemas: `chainIdParamSchema`, `quoteQuerySchema`, `swapBuildSchema`, `swapExecuteSchema`
- Middleware: `validateParams`, `validateQuery`, `validateBody` — reject invalid requests early

## 10. Safe Migration Strategy

- Endpoints refactored one by one: quotes (fast, best, batch), swap build
- Logic moved into UseCases; controllers delegate
- Blockchain calls wrapped in ViemBlockchainAdapter
- No endpoints removed; request/response formats preserved
