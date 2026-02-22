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
];

export function listChains() {
  return CHAINS;
}

export function getChain(chainId: string): ChainInfo | null {
  return CHAINS.find((c) => c.chainId === chainId) || null;
}
