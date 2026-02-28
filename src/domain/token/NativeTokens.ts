/**
 * NativeTokens — knowledge about native chain currencies.
 * These are not ERC-20s and have no contract address.
 */

export const NATIVE_SYMBOLS: ReadonlySet<string> = new Set([
  "ETH",
  "PLS",
  "MATIC",
  "PULSE",
]);

/** Returns true if the symbol refers to a chain's native currency. */
export function isNativeToken(symbol: string): boolean {
  return NATIVE_SYMBOLS.has(symbol.toUpperCase());
}

/**
 * Given a nullable TokenInfo lookup result, return the value that should
 * be forwarded to the router as tokenIn / tokenOut.
 *
 * - Resolved ERC-20 → use its checksum address
 * - native symbol  → pass the lowercase symbol (adapter convention)
 * - raw 0x address → pass as-is
 */
export function resolveTokenInput(
  found: { address: string } | null,
  identifier: string,
  isNative: boolean,
): string {
  if (isNative) return identifier.toLowerCase();
  if (found) return found.address;
  return identifier;
}
