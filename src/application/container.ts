/**
 * Simple DI container - provides UseCase instances with injected dependencies
 */
import { viemBlockchainAdapter } from "../infrastructure/blockchain";
import { GetQuoteUseCase } from "../modules/swap/application/GetQuoteUseCase";
import { BuildTransactionUseCase } from "../modules/transaction/application/BuildTransactionUseCase";

export const getQuoteUseCase = new GetQuoteUseCase(viemBlockchainAdapter);
export const buildTransactionUseCase = new BuildTransactionUseCase(
  viemBlockchainAdapter,
);
