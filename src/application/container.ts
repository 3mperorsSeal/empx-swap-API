/**
 * Simple DI container - provides UseCase instances with injected dependencies
 */
import { staticTokenRepository } from "../domain/token/StaticTokenRepository";
import { viemBlockchainAdapter } from "../infrastructure/blockchain";
import { GetQuoteUseCase } from "../modules/quotes/application/GetQuoteUseCase";
import { BuildTransactionUseCase } from "../modules/swap/application/BuildTransactionUseCase";

export const getQuoteUseCase = new GetQuoteUseCase(
  viemBlockchainAdapter,
  staticTokenRepository,
);
export const buildTransactionUseCase = new BuildTransactionUseCase(
  viemBlockchainAdapter,
  staticTokenRepository,
);
