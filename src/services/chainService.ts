export type ChainInfo = {
  chainId: string;
  name: string;
  rpc?: string;
  nativeCurrency?: { name: string; symbol: string; decimals: number };
};

// Minimal static chain list; extend or replace with DB/Env-driven data later
const CHAINS: ChainInfo[] = [
  {
    chainId: "1",
    name: "Ethereum Mainnet",
    rpc: process.env.ETHEREUM_RPC_URL || "",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  {
    chainId: "137",
    name: "Polygon",
    rpc: process.env.POLYGON_RPC_URL || "",
    nativeCurrency: { name: "Matic", symbol: "MATIC", decimals: 18 },
  },
  {
    chainId: "369",
    name: "PulseChain",
    rpc: process.env.PULSECHAIN_RPC_URL || "https://rpc.pulsechain.com/",
    nativeCurrency: { name: "PLS", symbol: "PLS", decimals: 18 },
  },
  {
    chainId: "8453",
    name: "Base",
    rpc: process.env.BASE_RPC_URL || "https://mainnet.base.org/",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
  {
    chainId: "146",
    name: "Sonic",
    rpc: process.env.SONIC_RPC_URL || "https://sonic-rpc.mainnet.sonic.network/",
    nativeCurrency: { name: "SONIC", symbol: "SONIC", decimals: 18 },
  },
  {
    chainId: "80094",
    name: "Berachain",
    rpc: process.env.BERACHAIN_RPC_URL || "https://rpc.berachain.com/",
    nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
  },
  {
    chainId: "30",
    name: "Rootstock",
    rpc: process.env.ROOTSTOCK_RPC_URL || "https://rpc.rootstock.io/",
    nativeCurrency: { name: "RBTC", symbol: "RBTC", decimals: 18 },
  },
  {
    chainId: "10001",
    name: "EthereumPoW",
    rpc: process.env.ETHEREUMPOW_RPC_URL || "https://rpc.mainnet.ethereumpow.org/",
    nativeCurrency: { name: "ETHW", symbol: "ETHW", decimals: 18 },
  },
  {
    chainId: "1329",
    name: "Sei",
    rpc: process.env.SEI_RPC_URL || "https://sei.drpc.org",
    nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
  }
];

export function listChains() {
  return CHAINS;
}

export function getChain(chainId: string): ChainInfo | null {
  return CHAINS.find((c) => c.chainId === chainId) || null;
}
