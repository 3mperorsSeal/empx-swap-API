/**
 * Viem blockchain adapter - single instance for DI
 */
import { ViemBlockchainAdapter } from "./ViemBlockchainAdapter";

export const viemBlockchainAdapter = new ViemBlockchainAdapter();
export { ViemBlockchainAdapter };
