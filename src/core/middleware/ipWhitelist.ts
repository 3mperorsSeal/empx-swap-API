/**
 * ipWhitelist — shared IP/domain allow-list helpers.
 * Used by both apiKeyGuard (prefix-only) and authMiddleware (full-hash verify).
 */
import ipaddr, { IPv4, IPv6 } from "ipaddr.js";

function normalizeIp(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isIPv4(addr: IPv4 | IPv6): addr is IPv4 {
  return addr.kind() === "ipv4";
}

function isIPv6(addr: IPv4 | IPv6): addr is IPv6 {
  return addr.kind() === "ipv6";
}

/**
 * Returns true if `rawIp` is in the given allow-list.
 * Each entry may be an exact IP or a CIDR range; both IPv4 and IPv6 are supported.
 */
export function isIpAllowed(rawIp: string, allowed: string[]): boolean {
  if (!allowed.length) return false;
  try {
    const ip = normalizeIp(rawIp);
    const clientIp = ipaddr.parse(ip);

    return allowed.some((entry) => {
      if (entry.includes("/")) {
        const [rangeIp, bits] = ipaddr.parseCIDR(entry);
        if (isIPv4(clientIp) && isIPv4(rangeIp))
          return clientIp.match(rangeIp, bits);
        if (isIPv6(clientIp) && isIPv6(rangeIp))
          return clientIp.match(rangeIp, bits);
        return false;
      }
      return clientIp.toString() === entry;
    });
  } catch {
    return false;
  }
}

/**
 * Returns true if `host` (bare hostname, no scheme) is allowed by the list.
 * Entries may use a wildcard prefix (`*.example.com`) or exact match.
 */
export function isDomainAllowed(host: string, allowed: string[]): boolean {
  return allowed.some((rule) => {
    if (rule.startsWith("*.")) return host.endsWith(rule.slice(1));
    return host === rule;
  });
}

/**
 * Extracts a clean hostname from an `origin` / `referer` header value.
 * Returns an empty string when the origin is unparseable.
 */
export function originToHost(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}
