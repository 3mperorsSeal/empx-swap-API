import {
  listChains as baseListChains,
  getChain as baseGetChain,
} from "../../services/chainService";
import { listTokens as baseListTokens } from "../../services/quoteService";
import { listAdaptersForChain as baseListAdapters } from "../../services/chainAdapterService";

export async function listChains() {
  // Thin wrapper - keep module boundary for future logic
  return baseListChains();
}

export async function getChain(chainId: string) {
  return baseGetChain(chainId);
}

export async function listTokens(
  chainId: string,
  search = "",
  limit = 25,
  offset = 0,
) {
  return baseListTokens(chainId, search, limit, offset);
}

export async function listAdapters(chainId: string) {
  const items = await baseListAdapters(chainId);
  return { total: items.length, items };
}
