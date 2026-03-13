/**
 * Contract ABIs
 *
 * Based on EmpsealRouterLiteV4 specification from api-scope.md
 */

/**
 * EmpsealRouter ABI - Main router contract for swaps
 *
 * Functions based on api-scope.md:
 * - swapNoSplit: Simple single-path swap
 * - swapNoSplitFromPLS: Swap from native PLS
 * - swapNoSplitToPLS: Swap to native PLS
 * - executeSplitSwap: Multi-path swap
 * - executeConvergeSwap: Two-stage converge swap
 */
export const EMPSEAL_ROUTER_ABI = [
  {
    type: "function",
    name: "swapNoSplit",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "trade",
        type: "tuple",
        components: [
          { name: "amountIn", type: "uint256" },
          { name: "amountOut", type: "uint256" },
          { name: "path", type: "address[]" },
          { name: "adapters", type: "address[]" },
        ],
      },
      { name: "to", type: "address" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "swapNoSplitFromPLS",
    stateMutability: "payable",
    inputs: [
      {
        name: "trade",
        type: "tuple",
        components: [
          { name: "amountIn", type: "uint256" },
          { name: "amountOut", type: "uint256" },
          { name: "path", type: "address[]" },
          { name: "adapters", type: "address[]" },
        ],
      },
      { name: "to", type: "address" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "swapNoSplitToPLS",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "trade",
        type: "tuple",
        components: [
          { name: "amountIn", type: "uint256" },
          { name: "amountOut", type: "uint256" },
          { name: "path", type: "address[]" },
          { name: "adapters", type: "address[]" },
        ],
      },
      { name: "to", type: "address" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "swapNoSplitFromETH",
    stateMutability: "payable",
    inputs: [
      {
        name: "trade",
        type: "tuple",
        components: [
          { name: "amountIn", type: "uint256" },
          { name: "amountOut", type: "uint256" },
          { name: "path", type: "address[]" },
          { name: "adapters", type: "address[]" },
        ],
      },
      { name: "to", type: "address" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "swapNoSplitToETH",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "trade",
        type: "tuple",
        components: [
          { name: "amountIn", type: "uint256" },
          { name: "amountOut", type: "uint256" },
          { name: "path", type: "address[]" },
          { name: "adapters", type: "address[]" },
        ],
      },
      { name: "to", type: "address" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "executeSplitSwap",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "paths",
        type: "tuple[]",
        components: [
          { name: "path", type: "address[]" },
          { name: "adapters", type: "address[]" },
          { name: "proportion", type: "uint256" },
        ],
      },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "to", type: "address" },
      { name: "fee", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "executeConvergeSwap",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "trade",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "intermediate", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          {
            name: "inputHops",
            type: "tuple[]",
            components: [
              { name: "adapter", type: "address" },
              { name: "proportion", type: "uint256" },
              { name: "data", type: "bytes" },
            ],
          },
          {
            name: "outputHop",
            type: "tuple",
            components: [
              { name: "adapter", type: "address" },
              { name: "proportion", type: "uint256" },
              { name: "data", type: "bytes" },
            ],
          },
        ],
      },
      { name: "minAmountOut", type: "uint256" },
      { name: "to", type: "address" },
      { name: "fee", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "FEE_DENOMINATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "FEE_CLAIMER",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  // ── Query functions ──────────────────────────────────────────────────────
  {
    type: "function",
    name: "findBestPath",
    stateMutability: "view",
    inputs: [
      { name: "_amountIn", type: "uint256" },
      { name: "_tokenIn", type: "address" },
      { name: "_tokenOut", type: "address" },
      { name: "_maxSteps", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amounts", type: "uint256[]" },
          { name: "adapters", type: "address[]" },
          { name: "path", type: "address[]" },
          { name: "gasEstimate", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "queryNoSplit",
    stateMutability: "view",
    inputs: [
      { name: "_amountIn", type: "uint256" },
      { name: "_tokenIn", type: "address" },
      { name: "_tokenOut", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "adapter", type: "address" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountOut", type: "uint256" },
        ],
      },
    ],
  },
] as const;

/**
 * Adapter Interface ABI - For querying DEX adapters
 */
export const ADAPTER_ABI = [
  {
    type: "function",
    name: "query",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

/**
 * ERC20 Token ABI - Standard token functions
 */
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

/**
 * WETH9 ABI - Wrapped native token
 */
export const WETH_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  ...ERC20_ABI,
] as const;

/**
 * Multicall3 ABI - For batch calls
 */
export const MULTICALL3_ABI = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;
