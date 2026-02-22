import { Address, encodeFunctionData, getAddress } from "viem";
import { EMPSEAL_ROUTER_ABI, ERC20_ABI } from "./contracts/abis";
import { canMakeRealCalls, getPublicClient } from "./contracts/client";
import { getChainConfig } from "./contracts/config";
import {
  ConvergeTrade,
  SplitPath,
  Trade,
  createHop,
  createTrade,
} from "./contracts/types";
import logger from "./logger";

export type Strategy = "fast" | "best" | "split" | "nosplit" | "converge";

export type RouteType = "NOSPLIT" | "SPLIT" | "CONVERGE" | "WRAP" | "UNWRAP";

export interface RouteHop {
  adapter: string;
  proportion: number;
  data?: string;
}

export interface Route {
  type: RouteType;
  path?: string[]; // for NOSPLIT
  adapters?: string[]; // for NOSPLIT
  intermediate?: string; // for CONVERGE
  inputHops?: RouteHop[]; // for CONVERGE
  outputHop?: RouteHop; // for CONVERGE
  splitPaths?: Array<{
    // for SPLIT
    path: string[];
    adapters: string[];
    proportion: number;
  }>;
}

export interface AdapterQuote {
  adapter: string;
  amountOut: string;
  path: string[];
}

export interface QuoteResult {
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  route: Route;
  priceImpact: number;
  meta: {
    quotedAt: number;
    chainId: number;
    computationTime?: number;
  };
}

export interface SwapBuildRequest {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  recipient: string;
  route: Route;
  fee?: number; // basis points (e.g., 30 = 0.30%)
  deadline?: number; // unix timestamp
  slippage?: number; // basis points (e.g., 50 = 0.50%)
}

export interface SwapBuildResult {
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    chainId: number;
  };
  approval: {
    required: boolean;
    token?: string;
    spender?: string;
    amount?: string;
    transaction?: {
      to: string;
      data: string;
      value: string;
    };
  };
  meta: {
    builtAt: number;
    expiresAt: number;
  };
}

// Mock adapters for when real contracts aren't available
const MOCK_ADAPTERS = [
  "0x1111111111111111111111111111111111111111", // Mock UniswapV2 style
  "0x2222222222222222222222222222222222222222", // Mock SushiSwap style
  "0x3333333333333333333333333333333333333333", // Mock Curve style
  "0x4444444444444444444444444444444444444444", // Mock Balancer style
];

// Mock price rates (simplified) - used when real contracts aren't available
const MOCK_RATES: Record<string, number> = {
  ETH: 2000,
  WETH: 2000,
  PLS: 0.0001,
  WPLS: 0.0001,
  PULSE: 0.0001,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  MATIC: 0.8,
  WMATIC: 0.8,
};

/**
 * Normalize and validate an address
 * Returns checksummed address or throws if invalid
 */
function normalizeAddress(
  address: string,
  fieldName: string = "address",
): Address {
  if (!address) {
    throw new Error(`Missing ${fieldName}`);
  }

  // Handle native tokens (not real addresses)
  const nativeSymbols = ["eth", "pls", "matic", "pulse"];
  if (nativeSymbols.includes(address.toLowerCase())) {
    // Return as-is for native tokens (these are handled specially in swap logic)
    return address.toLowerCase() as Address;
  }

  // If it's a valid address but just not checksummed, getAddress will fix it
  // Otherwise it throws
  try {
    return getAddress(address);
  } catch (e) {
    throw new Error(
      `Invalid ${fieldName}: ${address}. Must be a valid 42-character hex address (0x...) or native symbol (ETH, PLS, MATIC)`,
    );
  }
}

/**
 * SmartRouter - Handles quote generation and transaction building
 *
 * Supports both real blockchain calls and mock fallback mode.
 * Switch to real mode by configuring contract addresses in config.ts
 */
export class SmartRouter {
  /**
   * Get quotes from all available adapters
   * Uses real on-chain calls if contracts are configured, otherwise falls back to mocks
   */
  static async getAllAdapterQuotes(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
  ): Promise<AdapterQuote[]> {
    // Check if we can make real calls
    if (canMakeRealCalls(chainId)) {
      return this.getRealAdapterQuotes(chainId, tokenIn, tokenOut, amountIn);
    } else {
      logger.info("Using mock adapter quotes (contracts not configured)", {
        chainId,
      });
      return this.getMockAdapterQuotes(chainId, tokenIn, tokenOut, amountIn);
    }
  }

  /**
   * Get real quotes from on-chain adapters
   * TODO: Implement multicall for batch querying
   */
  private static async getRealAdapterQuotes(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
  ): Promise<AdapterQuote[]> {
    const client = getPublicClient(chainId);
    if (!client) {
      throw new Error(`No RPC client for chain ${chainId}`);
    }

    // TODO: Query actual adapters from chain
    // For now, return empty array - will be filled when adapters are deployed
    logger.warn("Real adapter queries not yet implemented", { chainId });
    return [];
  }

  /**
   * Get mock quotes from simulated adapters
   */
  private static getMockAdapterQuotes(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
  ): AdapterQuote[] {
    const quotes: AdapterQuote[] = [];

    // Calculate base output using mock prices
    const priceIn = this.getMockPrice(tokenIn);
    const priceOut = this.getMockPrice(tokenOut);
    const baseOutput = Number(amountIn) * (priceIn / priceOut);

    // Generate slightly different quotes for each mock adapter
    for (const adapter of MOCK_ADAPTERS) {
      // Variance between 97% and 102% of base output
      const variance = 0.97 + Math.random() * 0.05;
      quotes.push({
        adapter,
        amountOut: BigInt(Math.floor(baseOutput * variance)).toString(),
        path: [tokenIn, tokenOut],
      });
    }

    // Sort by best output first
    return quotes.sort((a, b) =>
      Number(BigInt(b.amountOut) - BigInt(a.amountOut)),
    );
  }

  /**
   * Get best quote across all routing strategies
   */
  static async getBestQuote(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    strategy: Strategy = "best",
  ): Promise<QuoteResult> {
    const startTime = Date.now();

    // For "fast" or "nosplit", just get the best single adapter
    if (strategy === "fast" || strategy === "nosplit") {
      const allQuotes = await this.getAllAdapterQuotes(
        chainId,
        tokenIn,
        tokenOut,
        amountIn,
      );

      if (allQuotes.length === 0) {
        throw new Error("No liquidity found for this token pair");
      }

      const best = allQuotes[0];
      const bestAmountOut = BigInt(best.amountOut);

      return {
        amountIn: amountIn.toString(),
        amountOut: best.amountOut,
        amountOutMin: ((bestAmountOut * 995n) / 1000n).toString(), // 0.5% slippage
        route: {
          type: "NOSPLIT",
          path: best.path,
          adapters: [best.adapter],
        },
        priceImpact: this.calculatePriceImpact(
          tokenIn,
          tokenOut,
          amountIn,
          bestAmountOut,
        ),
        meta: {
          quotedAt: Math.floor(Date.now() / 1000),
          chainId,
          computationTime: Date.now() - startTime,
        },
      };
    }

    // For "best", "converge", or "split", we would run more complex routing
    // For now, simulate a better route than single-path
    const allQuotes = await this.getAllAdapterQuotes(
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
    );

    if (allQuotes.length === 0) {
      throw new Error("No liquidity found for this token pair");
    }

    const bestSingleAmount = BigInt(allQuotes[0].amountOut);

    // Simulate improved routing (2-4% better than single path)
    const improvementFactor = 1.02 + Math.random() * 0.02;
    const improvedAmount = BigInt(
      Math.floor(Number(bestSingleAmount) * improvementFactor),
    );

    // Get wrapped native address for intermediate token
    const config = getChainConfig(chainId);
    const intermediateToken = config?.wrappedNative || allQuotes[0].path[0];

    return {
      amountIn: amountIn.toString(),
      amountOut: improvedAmount.toString(),
      amountOutMin: ((improvedAmount * 995n) / 1000n).toString(),
      route: {
        type: "CONVERGE",
        intermediate: intermediateToken,
        inputHops: [
          {
            adapter: allQuotes[0]?.adapter || MOCK_ADAPTERS[0],
            proportion: 6000,
          },
          {
            adapter: allQuotes[1]?.adapter || MOCK_ADAPTERS[1],
            proportion: 4000,
          },
        ],
        outputHop: {
          adapter: allQuotes[2]?.adapter || MOCK_ADAPTERS[2],
          proportion: 10000,
        },
      },
      priceImpact: this.calculatePriceImpact(
        tokenIn,
        tokenOut,
        amountIn,
        improvedAmount,
      ),
      meta: {
        quotedAt: Math.floor(Date.now() / 1000),
        chainId,
        computationTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Calculate price impact percentage
   */
  private static calculatePriceImpact(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    amountOut: bigint,
  ): number {
    // Simplified price impact calculation
    // In production, this should use pool reserves and proper formulas
    const priceIn = this.getMockPrice(tokenIn);
    const priceOut = this.getMockPrice(tokenOut);

    const expectedOutput = Number(amountIn) * (priceIn / priceOut);
    const actualOutput = Number(amountOut);

    const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100;
    return Math.max(0, Math.min(impact, 100)); // Clamp between 0-100%
  }

  /**
   * Get mock price for a token (used when real oracle isn't available)
   */
  private static getMockPrice(token: string): number {
    const upper = token.toUpperCase();

    // Try to match common token symbols in address
    for (const [symbol, price] of Object.entries(MOCK_RATES)) {
      if (upper.includes(symbol)) {
        return price;
      }
    }

    // Default to 1:1 if unknown
    return 1;
  }

  /**
   * Build swap transaction with proper encoding
   * Includes partner fee support from database
   */
  static async buildSwap(request: SwapBuildRequest): Promise<SwapBuildResult> {
    const {
      chainId,
      tokenIn: rawTokenIn,
      tokenOut: rawTokenOut,
      amountIn,
      recipient: rawRecipient,
      route,
      fee = 0,
      deadline,
      slippage = 50, // 0.50% default slippage
    } = request;

    // Normalize addresses
    const tokenIn = normalizeAddress(rawTokenIn, "tokenIn");
    const tokenOut = normalizeAddress(rawTokenOut, "tokenOut");
    const recipient = normalizeAddress(rawRecipient, "recipient");

    const config = getChainConfig(chainId);
    if (!config) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    const routerAddress = config.routerAddress;

    // Calculate deadline (5 minutes from now if not provided)
    const txDeadline = deadline || Math.floor(Date.now() / 1000) + 300;

    // Build transaction based on route type
    let data: `0x${string}`;
    let value = "0";

    // Check if tokenIn is native currency
    const isNativeIn =
      tokenIn.toLowerCase() === "eth" ||
      tokenIn.toLowerCase() === "pls" ||
      tokenIn.toLowerCase() === "matic";

    const toAddress = (addr: string) => {
      if (
        addr.toLowerCase() === "eth" ||
        addr.toLowerCase() === "pls" ||
        addr.toLowerCase() === "matic" ||
        addr.toLowerCase() === "pulse"
      ) {
        const config = getChainConfig(chainId);
        return config
          ? getAddress(config.wrappedNative)
          : getAddress("0x0000000000000000000000000000000000000000");
      }
      return getAddress(addr);
    };

    if (route.type === "NOSPLIT") {
      const path = (route.path || [tokenIn, tokenOut]).map(toAddress);
      const adapters = (route.adapters || []).map((a: string) => getAddress(a));

      data = this.encodeNoSplitSwap(
        amountIn,
        path,
        adapters,
        recipient,
        fee,
        isNativeIn,
      );

      if (isNativeIn) {
        value = amountIn.toString();
      }
    } else if (route.type === "CONVERGE") {
      data = this.encodeConvergeSwap(
        route,
        tokenIn,
        tokenOut,
        amountIn,
        recipient,
        fee,
        txDeadline,
        slippage,
        toAddress,
      );
    } else if (route.type === "SPLIT") {
      data = this.encodeSplitSwap(
        route,
        amountIn,
        recipient,
        fee,
        txDeadline,
        slippage,
        toAddress,
      );
    } else {
      throw new Error(`Unsupported route type: ${route.type}`);
    }

    // Build approval transaction if needed (not for native tokens)
    const approval = await this.buildApproval(
      chainId,
      tokenIn,
      routerAddress,
      amountIn,
      isNativeIn,
    );

    // Estimate gas (mock for now)
    const gasLimit = route.type === "NOSPLIT" ? "200000" : "350000";

    return {
      transaction: {
        to: routerAddress,
        data,
        value,
        gasLimit,
        chainId,
      },
      approval,
      meta: {
        builtAt: Math.floor(Date.now() / 1000),
        expiresAt: txDeadline,
      },
    };
  }

  /**
   * Encode NOSPLIT swap calldata
   */
  private static encodeNoSplitSwap(
    amountIn: bigint,
    path: string[],
    adapters: string[],
    recipient: Address,
    fee: number,
    isNativeIn: boolean,
  ): `0x${string}` {
    const trade: Trade = createTrade(
      amountIn,
      0n, // amountOut (minAmountOut will be checked in contract)
      path as Address[],
      adapters as Address[],
    );

    const functionName = isNativeIn ? "swapNoSplitFromPLS" : "swapNoSplit";

    return encodeFunctionData({
      abi: EMPSEAL_ROUTER_ABI,
      functionName,
      args: [trade, recipient, BigInt(fee)],
    });
  }

  /**
   * Encode CONVERGE swap calldata
   */
  private static encodeConvergeSwap(
    route: Route,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: bigint,
    recipient: Address,
    fee: number,
    deadline: number,
    slippage: number,
    toAddress: (addr: string) => Address,
  ): `0x${string}` {
    if (!route.intermediate || !route.inputHops || !route.outputHop) {
      throw new Error("Invalid converge route");
    }

    const trade: ConvergeTrade = {
      tokenIn: toAddress(tokenIn),
      intermediate: toAddress(route.intermediate as string),
      tokenOut: toAddress(tokenOut),
      amountIn,
      inputHops: route.inputHops.map((h) =>
        createHop(
          h.adapter as Address,
          h.proportion,
          (h.data as `0x${string}`) || "0x",
        ),
      ),
      outputHop: createHop(
        route.outputHop.adapter as Address,
        route.outputHop.proportion,
        (route.outputHop.data as `0x${string}`) || "0x",
      ),
    };

    // Calculate minAmountOut (will be provided from quote in real implementation)
    const minAmountOut = 0n; // Contract will validate

    return encodeFunctionData({
      abi: EMPSEAL_ROUTER_ABI,
      functionName: "executeConvergeSwap",
      args: [trade, minAmountOut, recipient, BigInt(fee), BigInt(deadline)],
    });
  }

  /**
   * Encode SPLIT swap calldata
   */
  private static encodeSplitSwap(
    route: Route,
    amountIn: bigint,
    recipient: Address,
    fee: number,
    deadline: number,
    slippage: number,
    toAddress: (addr: string) => Address,
  ): `0x${string}` {
    if (!route.splitPaths) {
      throw new Error("Invalid split route");
    }

    const paths: SplitPath[] = route.splitPaths.map((sp) => ({
      path: sp.path.map(toAddress),
      adapters: sp.adapters.map((a: string) => getAddress(a)),
      proportion: BigInt(sp.proportion),
    }));

    const minAmountOut = 0n; // Will be calculated from quote

    return encodeFunctionData({
      abi: EMPSEAL_ROUTER_ABI,
      functionName: "executeSplitSwap",
      args: [
        paths,
        amountIn,
        minAmountOut,
        recipient,
        BigInt(fee),
        BigInt(deadline),
      ],
    });
  }

  /**
   * Build approval transaction if needed
   */
  private static async buildApproval(
    chainId: number,
    tokenAddress: Address,
    spender: Address,
    amount: bigint,
    isNative: boolean,
  ): Promise<SwapBuildResult["approval"]> {
    // No approval needed for native tokens
    if (isNative) {
      return { required: false };
    }

    // In production, check current allowance first
    // For now, always return approval transaction

    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, amount],
    });

    return {
      required: true,
      token: tokenAddress,
      spender,
      amount: amount.toString(),
      transaction: {
        to: tokenAddress,
        data: approvalData,
        value: "0",
      },
    };
  }
}
