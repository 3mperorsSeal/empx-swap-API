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
import logger from "../core/logger";

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

/**
 * Result returned by findBestPath.
 * Ranks all available nosplit adapter quotes and exposes the winner
 * as well as the full ranked list for inspection / fallback.
 */
export interface BestPathResult {
  /** Best adapter address */
  bestAdapter: string;
  /** Expected output amount (as string to preserve bigint precision) */
  amountOut: string;
  /** Minimum output after slippage (default 0.5%) */
  amountOutMin: string;
  /** Full token path for this route (may be multi-hop) */
  path: string[];
  /** All adapter addresses used along the path, in order */
  adapters: string[];
  /** All intermediate amounts along the path */
  amounts: string[];
  /** Price impact as a percentage (0–100) */
  priceImpact: number;
  /** All adapter quotes ranked best-first (populated in mock mode; empty in on-chain mode) */
  allQuotes: AdapterQuote[];
  meta: {
    quotedAt: number;
    chainId: number;
    computationTime: number;
    strategy: "nosplit";
    mode: "onchain" | "mock";
  };
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

// Mock adapters have been disabled — all adapter quotes must come from on-chain calls.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const GENERIC_NATIVE_SYMBOLS = new Set(["eth", "pls", "matic", "pulse"]);

type NoSplitFunctionName =
  | "swapNoSplit"
  | "swapNoSplitFromPLS"
  | "swapNoSplitToPLS"
  | "swapNoSplitFromETH"
  | "swapNoSplitToETH";

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
  private static isZeroAddress(token: string): boolean {
    return token.toLowerCase() === ZERO_ADDRESS;
  }

  private static isNativeLikeToken(chainId: number, token: string): boolean {
    const lower = token.toLowerCase();
    if (GENERIC_NATIVE_SYMBOLS.has(lower) || this.isZeroAddress(lower)) {
      return true;
    }

    const config = getChainConfig(chainId);
    if (!config) {
      return false;
    }

    return (
      lower === config.nativeCurrency.symbol.toLowerCase() ||
      lower === config.symbol.toLowerCase()
    );
  }

  /**
   * Converts native inputs (symbol or zero address) to wrapped token address.
   * Non-native addresses are returned checksummed.
   */
  private static toRouterTokenAddress(chainId: number, token: string): Address {
    const config = getChainConfig(chainId);
    if (!config) {
      throw new Error(`No chain config for chainId ${chainId}`);
    }

    if (this.isNativeLikeToken(chainId, token)) {
      return getAddress(config.wrappedNative);
    }

    return getAddress(token);
  }

  private static getNoSplitFunctionName(
    chainId: number,
    isNativeIn: boolean,
    isNativeOut: boolean,
  ): NoSplitFunctionName {
    if (isNativeIn && isNativeOut) {
      throw new Error("Native-to-native swap is not supported for NOSPLIT route");
    }

    if (!isNativeIn && !isNativeOut) {
      return "swapNoSplit";
    }

    if (chainId === 369) {
      return isNativeIn ? "swapNoSplitFromPLS" : "swapNoSplitToPLS";
    }

    return isNativeIn ? "swapNoSplitFromETH" : "swapNoSplitToETH";
  }

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
    const routedTokenIn = this.toRouterTokenAddress(chainId, tokenIn);
    const routedTokenOut = this.toRouterTokenAddress(chainId, tokenOut);

    // Real on-chain calls are required — mock fallback has been disabled.
    if (!canMakeRealCalls(chainId)) {
      throw new Error(
        `getAllAdapterQuotes: contracts not configured for chain ${chainId}. Mock adapter fallback is disabled.`,
      );
    }

    return this.getRealAdapterQuotes(
      chainId,
      routedTokenIn,
      routedTokenOut,
      amountIn,
    );
  }

  /**
   * Get real quotes from the on-chain router using queryNoSplit.
   * The router iterates all its registered adapters and returns the best one.
   */
  private static async getRealAdapterQuotes(
    chainId: number,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: bigint,
  ): Promise<AdapterQuote[]> {
    const client = getPublicClient(chainId);
    if (!client) {
      throw new Error(`No RPC client for chain ${chainId}`);
    }

    const config = getChainConfig(chainId);
    if (!config) {
      throw new Error(`No chain config for chainId ${chainId}`);
    }

    try {
      const result = await client.readContract({
        address: config.routerAddress,
        abi: EMPSEAL_ROUTER_ABI,
        functionName: "queryNoSplit",
        args: [amountIn, tokenIn, tokenOut],
      });

      if (!result || result.amountOut === 0n) {
        logger.warn("queryNoSplit returned no liquidity", { chainId, tokenIn, tokenOut });
        return [];
      }

      logger.debug("queryNoSplit result", {
        chainId,
        adapter: result.adapter,
        amountOut: result.amountOut.toString(),
      });

      return [
        {
          adapter: result.adapter,
          amountOut: result.amountOut.toString(),
          path: [tokenIn, tokenOut],
        },
      ];
    } catch (error) {
      logger.error("queryNoSplit contract call failed", { chainId, error });
      return [];
    }
  }

  // getMockAdapterQuotes has been removed — mock adapter fallback is disabled.

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

    // For "fast" or "nosplit", use router.findBestPath.
    // This returns the full selected route including every adapter hop.
    if (strategy === "fast" || strategy === "nosplit") {
      const bestPath = await this.findBestPath(chainId, tokenIn, tokenOut, amountIn);

      return {
        amountIn: amountIn.toString(),
        amountOut: bestPath.amountOut,
        amountOutMin: bestPath.amountOutMin,
        route: {
          type: "NOSPLIT",
          path: bestPath.path,
          adapters: bestPath.adapters,
        },
        priceImpact: bestPath.priceImpact,
        meta: {
          quotedAt: bestPath.meta.quotedAt,
          chainId,
          computationTime: Date.now() - startTime,
        },
      };
    }

    // CONVERGE / SPLIT / BEST strategies are not yet implemented with real on-chain data.
    // Mock-based simulation has been disabled to prevent conflicts with real calldata building.
    throw new Error(
      `Strategy "${strategy}" is not yet supported. Use "nosplit" or "fast" instead.`,
    );
  }

  /**
   * Calculate price impact percentage.
   * Returns 0 until a real on-chain oracle is wired up.
   * Mock price lookups have been removed.
   */
  private static calculatePriceImpact(
    _tokenIn: string,
    _tokenOut: string,
    _amountIn: bigint,
    _amountOut: bigint,
  ): number {
    // TODO: replace with real pool-reserve-based price impact once oracle is available.
    return 0;
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
      slippage = 15, // 0.50% default slippage
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

    // Compute slippage-protected minimum output
    // slippage is in basis points (e.g. 50 = 0.50%)
    const slippageDenom = 10_000n;
    const amountOutMin = (amountIn * (slippageDenom - BigInt(slippage))) / slippageDenom;

    // Build transaction based on route type
    let data: `0x${string}`;
    let value = "0";

    const isNativeIn = this.isNativeLikeToken(chainId, tokenIn);
    const isNativeOut = this.isNativeLikeToken(chainId, tokenOut);
    const toAddress = (addr: string) => this.toRouterTokenAddress(chainId, addr);

    if (route.type === "NOSPLIT") {
      const path = (route.path || [tokenIn, tokenOut]).map(toAddress);
      const adapters = (route.adapters || []).map((a: string) => getAddress(a));

      data = this.encodeNoSplitSwap(
        chainId,
        amountIn,
        amountOutMin,
        path,
        adapters,
        recipient,
        fee,
        isNativeIn,
        isNativeOut,
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
        amountOutMin,
        recipient,
        fee,
        txDeadline,
        toAddress,
      );
    } else if (route.type === "SPLIT") {
      data = this.encodeSplitSwap(
        route,
        amountIn,
        amountOutMin,
        recipient,
        fee,
        txDeadline,
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
    chainId: number,
    amountIn: bigint,
    amountOutMin: bigint,
    path: string[],
    adapters: string[],
    recipient: Address,
    fee: number,
    isNativeIn: boolean,
    isNativeOut: boolean,
  ): `0x${string}` {
    const trade: Trade = createTrade(
      amountIn,
      amountOutMin,
      path as Address[],
      adapters as Address[],
    );

    const functionName = this.getNoSplitFunctionName(
      chainId,
      isNativeIn,
      isNativeOut,
    );

    return encodeFunctionData({
      abi: EMPSEAL_ROUTER_ABI,
      functionName,
      args: [trade, recipient, BigInt(fee)],
    });
  }

  /**
   * Find the best single-path (nosplit) route across all available adapters.
   *
   * When contracts are configured this calls `router.findBestPath()` on-chain,
   * which does multi-hop routing through trusted tokens. Falls back to mock
   * data when contracts are not configured (dev / test mode).
   *
   * @param chainId     - Target chain
   * @param tokenIn     - Input token address (or native symbol e.g. "eth")
   * @param tokenOut    - Output token address
   * @param amountIn    - Exact input amount in wei
   * @param slippageBps - Slippage tolerance in basis points (default 50 = 0.5%)
   * @param maxSteps    - Max hops the router may use (1–4, default 3)
   */
  static async findBestPath(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    slippageBps: number = 50,
    maxSteps: number = 3,
  ): Promise<BestPathResult> {
    const startTime = Date.now();
    const routedTokenIn = this.toRouterTokenAddress(chainId, tokenIn);
    const routedTokenOut = this.toRouterTokenAddress(chainId, tokenOut);

    // ── On-chain mode ────────────────────────────────────────────────────
    if (canMakeRealCalls(chainId)) {
      const client = getPublicClient(chainId);
      const config = getChainConfig(chainId);

      if (!client || !config) {
        throw new Error(`findBestPath: No client/config for chain ${chainId}`);
      }

      const maxAllowedSteps = Math.max(1, config.maxHops || 1);
      const clampedSteps = Math.min(Math.max(maxSteps, 1), maxAllowedSteps);

      let offer: { amounts: readonly bigint[]; adapters: readonly Address[]; path: readonly Address[]; gasEstimate: bigint };

      try {
        offer = await client.readContract({
          address: config.routerAddress,
          abi: EMPSEAL_ROUTER_ABI,
          functionName: "findBestPath",
          args: [amountIn, routedTokenIn, routedTokenOut, BigInt(clampedSteps)],
        });
      } catch (error) {
        logger.error("findBestPath contract call failed", { chainId, error });
        throw new Error(`findBestPath: on-chain call failed for chain ${chainId}`);
      }

      // Empty path means the router found no route
      if (!offer.path || offer.path.length === 0 || !offer.amounts || offer.amounts.length === 0) {
        throw new Error(
          `findBestPath: No liquidity found for ${tokenIn} → ${tokenOut} on chain ${chainId}`,
        );
      }

      const bestAmountOut = offer.amounts[offer.amounts.length - 1];
      const slippageDenom = 10_000n;
      const amountOutMin = (
        (bestAmountOut * (slippageDenom - BigInt(slippageBps))) / slippageDenom
      ).toString();

      const priceImpact = this.calculatePriceImpact(
        tokenIn,
        tokenOut,
        amountIn,
        bestAmountOut,
      );

      logger.debug("findBestPath (onchain): route found", {
        chainId,
        tokenIn: routedTokenIn,
        tokenOut: routedTokenOut,
        path: offer.path,
        adapters: offer.adapters,
        amountOut: bestAmountOut.toString(),
        priceImpact,
      });

      return {
        bestAdapter: offer.adapters[0] ?? "",
        amountOut: bestAmountOut.toString(),
        amountOutMin,
        path: [...offer.path],
        adapters: [...offer.adapters],
        amounts: offer.amounts.map((a) => a.toString()),
        priceImpact,
        allQuotes: [], // not meaningful in on-chain mode
        meta: {
          quotedAt: Math.floor(Date.now() / 1000),
          chainId,
          computationTime: Date.now() - startTime,
          strategy: "nosplit",
          mode: "onchain",
        },
      };
    }

    // Mock fallback has been disabled — on-chain contracts must be configured.
    throw new Error(
      `findBestPath: contracts not configured for chain ${chainId}. Mock fallback is disabled.`,
    );
  }

  /**
   * Encode CONVERGE swap calldata
   */
  private static encodeConvergeSwap(
    route: Route,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: bigint,
    amountOutMin: bigint,
    recipient: Address,
    fee: number,
    deadline: number,
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

    return encodeFunctionData({
      abi: EMPSEAL_ROUTER_ABI,
      functionName: "executeConvergeSwap",
      args: [trade, amountOutMin, recipient, BigInt(fee), BigInt(deadline)],
    });
  }

  /**
   * Encode SPLIT swap calldata
   */
  private static encodeSplitSwap(
    route: Route,
    amountIn: bigint,
    amountOutMin: bigint,
    recipient: Address,
    fee: number,
    deadline: number,
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

    return encodeFunctionData({
      abi: EMPSEAL_ROUTER_ABI,
      functionName: "executeSplitSwap",
      args: [
        paths,
        amountIn,
        amountOutMin,
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
